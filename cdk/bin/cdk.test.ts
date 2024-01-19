import {riffRaff} from "./cdk";

describe('The riff-raff output YAML', () => {
  it('matches the snapshot', () => {
    // @ts-ignore
    const outdir = riffRaff.outdir; // this changes for every test execution and best not to change cdk.ts too much
    const riffRaffYaml = riffRaff.toYAML().replaceAll(outdir, 'cdk.out');
    expect(riffRaffYaml).toMatchSnapshot();
  });
});
