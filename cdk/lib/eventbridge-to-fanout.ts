import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import type { App } from 'aws-cdk-lib';
import { Fn, SecretValue } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

interface EventbridgeToFanoutStackProps extends GuStackProps {
	snsTopicUpdatesConfig: {
		cfnExportName: string;
		maybeFilterPattern?: object;
		inputTemplatePath: string;
	};
}

export class EventbridgeToFanout extends GuStack {
	constructor(scope: App, id: string, props: EventbridgeToFanoutStackProps) {
		super(scope, id, props);

		const eventBridgeBus = new events.EventBus(this, 'EventBridgeBus', {
			eventBusName: `${this.stack}-eventbridge-bus-${this.stage}`,
		});

		// cdk does not allow us to read the secret from ssm
		const connection = new events.Connection(this, 'Connection', {
			authorization: events.Authorization.apiKey(
				'Fastly-Key',
				SecretValue.secretsManager(`FastlyFanoutApiKey${this.stage}`),
			),
			description: 'Fastly fanout authentication',
			connectionName: `fastly-fanout-connection-${this.stage}`,
		});

		// provisions the destination
		const destination = new events.ApiDestination(this, 'Destination', {
			connection,
			endpoint: `https://api.fastly.com/service/${
				process.env[`FASTLY_FANOUT_SERVICE_ID_${this.stage}`]
			}/publish/`,
			apiDestinationName: `fastly-fanout-api-destination-${this.stage}`,
		});

		new events.Rule(this, 'ApiDestinationRule', {
			eventBus: eventBridgeBus,
			ruleName: `${this.stack}-events-to-fastly-fanout-${this.stage}`,
			// wrapper to feed the destination as a valid target
			targets: [
				new targets.ApiDestination(destination, {
					event: events.RuleTargetInput.fromObject({
						items: [
							{
								channel: events.EventField.fromPath('$.detail.path'),
								formats: {
									// websocket connections
									'ws-message': {
										content: events.EventField.fromPath('$.time'),
									},
									// sse connections
									'http-stream': {
										content: `${events.EventField.fromPath('$.time')}\n`,
									},
								},
							},
						],
					}),
				}),
			],
			eventPattern: {
				region: [this.region],
			},
		});

		const snsTopic = sns.Topic.fromTopicArn(
			this,
			'SNSTopic',
			Fn.importValue(props.snsTopicUpdatesConfig.cfnExportName),
		);

		const sqsQueue = new sqs.Queue(this, 'SqsQueue');

		snsTopic.addSubscription(
			new SqsSubscription(sqsQueue, {
				rawMessageDelivery: true, // prevents message being wrapped in SNS envelope
			}),
		);

		const putEventsOnPipeRole = new iam.Role(
			this,
			'PipeFromSQSToEventBridgeRole',
			{
				inlinePolicies: {
					allowPutEventsFromPipe: new iam.PolicyDocument({
						statements: [
							new iam.PolicyStatement({
								effect: iam.Effect.ALLOW,
								actions: ['events:PutEvents'],
								resources: [eventBridgeBus.eventBusArn],
							}),
							new iam.PolicyStatement({
								effect: iam.Effect.ALLOW,
								actions: [
									'sqs:ReceiveMessage',
									'sqs:DeleteMessage',
									'sqs:GetQueueAttributes',
								],
								resources: [sqsQueue.queueArn],
							}),
						],
					}),
				},
				assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
			},
		);

		// NOTE: 'body' of the SQS message is implicitly parsed and contains the 'PressJob' JSON from the SNS message
		// see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-input-transformation.html#input-transform-implicit
		new pipes.CfnPipe(this, 'PipeFromSqsToEventBridge', {
			name: `fronts-updates-pipe-from-sqs-to-eventbridge-${this.stage}`,
			roleArn: putEventsOnPipeRole.roleArn,
			source: sqsQueue.queueArn,
			sourceParameters: props.snsTopicUpdatesConfig.maybeFilterPattern && {
				filterCriteria: {
					filters: [
						{
							pattern: JSON.stringify(
								props.snsTopicUpdatesConfig.maybeFilterPattern,
							),
						},
					],
				},
			},
			target: eventBridgeBus.eventBusArn,
			targetParameters: {
				inputTemplate: JSON.stringify({
					path: props.snsTopicUpdatesConfig.inputTemplatePath,
				}),
			},
		});
	}
}
