import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedIronData = await deploy("IronData", {
    from: deployer,
    log: true,
  });

  console.log(`IronData contract: `, deployedIronData.address);
};
export default func;
func.id = "deploy_ironData"; // id required to prevent reexecution
func.tags = ["IronData"];
