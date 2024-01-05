import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { EventbridgeToFanout } from '../lib/eventbridge-to-fanout';

const FRONTS_STACK = 'cms-fronts';
const CAPI_STACK = 'content-api-crier-v2'; // crier also has a preview stack (content-api-crier-v2-preview) but we don't think this is needed right now
const app = new GuRoot();

const env = { region: 'eu-west-1' };

// Fronts - this listens to SNS topic via SQS and EventBridge Pipe (before it gets to the event bus)
new EventbridgeToFanout(app, 'EventBridgeToFanout-eu-west-1-fronts-CODE', {
	stack: FRONTS_STACK,
	stage: 'CODE',
	env,
	maybeSnsTopicCfnExportName: 'facia-CODE-FrontsUpdateSNSTopicARN',
});
new EventbridgeToFanout(app, 'EventBridgeToFanout-eu-west-1-fronts-PROD', {
	stack: FRONTS_STACK,
	stage: 'PROD',
	env,
	maybeSnsTopicCfnExportName: 'facia-PROD-FrontsUpdateSNSTopicARN',
});

// CAPI - crier writes straight to the event bus
new EventbridgeToFanout(app, 'EventBridgeToFanout-eu-west-1-capi-CODE', {
	stack: CAPI_STACK,
	stage: 'CODE',
	env,
});

new EventbridgeToFanout(app, 'EventBridgeToFanout-eu-west-1-capi-PROD', {
	stack: CAPI_STACK,
	stage: 'PROD',
	env,
});
