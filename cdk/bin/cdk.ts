import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { EventbridgeToFanout } from '../lib/eventbridge-to-fanout';

const FRONTS_STACK = 'cms-fronts';
const CAPI_STACK = 'content-api-crier-v2'; // crier also has a preview stack (content-api-crier-v2-preview) but we don't think this is needed right now
const app = new GuRoot();

const env = { region: 'eu-west-1' };

['CODE', 'PROD'].map((stage) => {
	// Fronts - this listens to the fronts SNS topic (populated by the facia-tool)
	new EventbridgeToFanout(
		app,
		`EventBridgeToFanout-eu-west-1-fronts-${stage}`,
		{
			stack: FRONTS_STACK,
			stage,
			env,
			snsTopicDetail: {
				cfnExportName: `facia-${stage}-FrontsUpdateSNSTopicARN`,
				pathExtractionPattern: '<$.body.path>',
				maybeFilterObject: {
					body: {
						pressType: ['live'], // only send live events
					},
				},
			},
		},
	);

	// CAPI - this listens to the decache topic (populated by the fastly-cache-purger)
	new EventbridgeToFanout(app, `EventBridgeToFanout-eu-west-1-capi-${stage}`, {
		stack: CAPI_STACK,
		stage,
		env,
		snsTopicDetail: {
			cfnExportName: `content-PROD-DecachedSNSTopicARN`, //there is only a PROD instance, TODO: expose this
			pathExtractionPattern: '<$.messageAttributes.path>', //TODO: check this
		},
	});
});
