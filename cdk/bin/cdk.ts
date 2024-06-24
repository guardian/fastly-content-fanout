import 'source-map-support/register';
import { EventbridgeToFanout } from '../lib/eventbridge-to-fanout';
import {RiffRaffYamlFile} from "@guardian/cdk/lib/riff-raff-yaml-file";
import {App} from "aws-cdk-lib";

const FRONTS_STACK = 'cms-fronts';
const CAPI_STACK = 'content-api-fastly-cache-purger';
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
				inputTemplate: {
					path: '<$.body.path>',
					collectionIds: '<$.body.collectionIds>'
				},
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
			inputTemplate: {path: '<$.messageAttributes.path.stringValue>'},
		},
	});
});

export const riffRaff = new RiffRaffYamlFile(app);
const { riffRaffYaml: { deployments } } = riffRaff;

deployments.set("fastly-C@E-package", {
	type: "fastly-compute",
	app: "fastly-content-fanout",
	contentDirectory: "fastly-C@E-package",
	parameters: {},
	regions: new Set([env.region]),
	stacks: new Set(["mobile"]),
});

// Write the riff-raff.yaml file to the output directory.
// Must be explicitly called.
riffRaff.synth();

