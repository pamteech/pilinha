const GROUP = 'group.com.pamtech.pilinha';
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const groups = config?.ios?.entitlements?.['com.apple.security.application-groups'];
  return {
    type: 'widget',
    name: 'PilinhaWidget',
    displayName: 'Pilinha',
    bundleIdentifier: '.widget',
    deploymentTarget: '17.0',
    frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
    entitlements: {
      'com.apple.security.application-groups': Array.isArray(groups) && groups.length ? groups : [GROUP],
    },
  };
};
