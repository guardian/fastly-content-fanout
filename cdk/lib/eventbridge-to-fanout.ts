import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import {GuParameter, GuStack} from '@guardian/cdk/lib/constructs/core';
import type { App } from 'aws-cdk-lib';
import { SecretValue } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as pipes from 'aws-cdk-lib/aws-pipes';

interface EventbridgeToFanoutStackProps extends GuStackProps {
	maybeParamStorePathForKinesisStreamName?: string;
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
				SecretValue.secretsManager('FastlyFanoutApiKey'),
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

		if (props.maybeParamStorePathForKinesisStreamName) {
			const role = new iam.Role(this, 'PipeFromKinesisToEventBridgeRole', {
				inlinePolicies: {
					allowPutEventsFromPipe: new iam.PolicyDocument({
						statements: [
							new iam.PolicyStatement({
								effect: iam.Effect.ALLOW,
								actions: ['events:PutEvents'],
								resources: [eventBridgeBus.eventBusArn],
							}),
						],
					}),
				},
				assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
			});

			const kinesisStreamName = new GuParameter(this, 'kinesisStreamName', {
				fromSSM: true,
				default: props.maybeParamStorePathForKinesisStreamName,
			}).valueAsString

			const kinesisStreamArn = `arn:aws:kinesis:${this.region}:${this.account}:stream/${kinesisStreamName}`;

			new pipes.CfnPipe(this, 'PipeFromKinesisToEventBridge', {
				// only 3 required props, all the rest are optional
				roleArn: role.roleArn,
				source: kinesisStreamArn,
				target: eventBridgeBus.eventBusArn,
			});
		}
	}
}
