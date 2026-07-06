import { RIFF_RAFF_PROJECT_NAME, riffRaff } from './cdk';

describe('The riff-raff output YAML', () => {
	it('matches the snapshot', () => {
		const riffRaffYaml = riffRaff
			.toYAML(RIFF_RAFF_PROJECT_NAME)
			.replaceAll(/contentDirectory: .*/g, 'contentDirectory: cdk.out');

		expect(riffRaffYaml).toMatchSnapshot();
	});
});
