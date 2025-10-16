import * as pulumi from "@pulumi/pulumi";
import * as unifi from "@pulumi/unifi";

const config = new pulumi.Config();

const provider = new unifi.Provider("default", {
  allowInsecure: true,
  apiKey: config.requireSecret("api-key"),
  apiUrl: config.require("api-url"),
  site: "default",
});

unifi
  .getNetworkOutput(
    {
      name: "MGMT",
    },
    { provider }
  )
  .apply((network) => {
    pulumi.log.info(`${JSON.stringify(network, null, 2)}`);
  });
