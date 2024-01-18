import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { EventbridgeToFanout } from '../lib/eventbridge-to-fanout';

const FRONTS_STACK = 'cms-fronts';
const CAPI_STACK = 'content-api-crier-v2'; // crier also has a preview stack (content-api-crier-v2-preview) but we don't think this is needed right now
const app = new GuRoot();

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
		},
	);

	// CAPI - this gets updates via the decached SNS topic
	new EventbridgeToFanout(app, `EventBridgeToFanout-eu-west-1-capi-${stage}`, {
		stack: CAPI_STACK,
		stage,
		env,
		snsTopicUpdatesConfig: {
			cfnExportName: 'fastly-cache-purger-PROD-DecachedContentSNSTopicARN', // there is only a PROD cache purger so using it for both CODE and PROD eventbridge
			inputTemplatePath: '<$.messageAttributes.path>',
		},
	});
});
