// O Pilinha só usa notificações LOCAIS (alertas de preço). O expo-notifications
// adiciona o entitlement de push (aps-environment), que exige a capability
// Push Notifications no perfil da Apple. Removemos para o build não falhar.
const { withEntitlementsPlist } = require('expo/config-plugins');
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
