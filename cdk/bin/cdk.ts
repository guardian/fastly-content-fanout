import 'source-map-support/register';
import { RiffRaffYamlFile } from '@guardian/cdk/lib/riff-raff-yaml-file';
import { App } from 'aws-cdk-lib';
import { EventbridgeToFanout } from '../lib/eventbridge-to-fanout';

const FRONTS_STACK = 'cms-fronts';
const CAPI_STACK = 'content-api-fastly-cache-purger';
export const RIFF_RAFF_PROJECT_NAME = 'fastly-content-fanout';

const app = new App(); // note not `GuRoot` since we're adding additional deployments to the riff-raff yaml further down this file
const env = { region: 'eu-west-1' };

['CODE', 'PROD'].map((stage) => {
	// Fronts - this gets updates via the fronts update SNS topic
	new EventbridgeToFanout(
		app,
		`EventBridgeToFanout-eu-west-1-fronts-${stage}`,
		{
			stack: FRONTS_STACK,
			stage,
			env,
			snsTopicUpdatesConfig: {
				cfnExportName: `facia-${stage}-FrontsUpdateSNSTopicARN`,
				maybeFilterPattern: {
					body: {
						pressType: ['live'], // only send live events
					},
				},
				inputTemplatePath: '<$.body.path>',
			},
			riffRaffProjectName: RIFF_RAFF_PROJECT_NAME,
		},
	);

	// CAPI - this gets updates via the decached SNS topic
	new EventbridgeToFanout(app, `EventBridgeToFanout-eu-west-1-capi-${stage}`, {
		stack: CAPI_STACK,
		stage,
		env,
		snsTopicUpdatesConfig: {
			cfnExportName: 'fastly-cache-purger-PROD-DecachedContentSNSTopicARN', // there is only a PROD cache purger so using it for both CODE and PROD eventbridge
			inputTemplatePath: '<$.messageAttributes.path.stringValue>',
		},
		riffRaffProjectName: RIFF_RAFF_PROJECT_NAME,
	});
});

export const riffRaff = new RiffRaffYamlFile(app);
const { configuration } = riffRaff;

configuration
	.get(RIFF_RAFF_PROJECT_NAME)
	?.deployments.set('fastly-C@E-package', {
		type: 'fastly-compute',
		app: 'fastly-content-fanout',
		contentDirectory: 'fastly-C@E-package',
		parameters: {},
		regions: new Set([env.region]),
		stacks: new Set(['mobile']),
	});

// Write the riff-raff.yaml file to the output directory.
// Must be explicitly called.
riffRaff.synth();
