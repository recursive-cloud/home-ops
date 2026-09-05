module.exports = function (env) {
  return {
    [env.RECURSIVE_CLOUD_APP_ID]: {
      appId: parseInt(env.RECURSIVE_CLOUD_APP_ID, 10),
      privateKey: env.RECURSIVE_CLOUD_PRIVATE_KEY,
      webhookSecret: env.RECURSIVE_CLOUD_WEBHOOK_SECRET,
    },
    [env.GUNZY83_APP_ID]: {
      appId: parseInt(env.GUNZY83_APP_ID, 10),
      privateKey: env.GUNZY83_PRIVATE_KEY,
      webhookSecret: env.GUNZY83_WEBHOOK_SECRET,
    },
  };
};
