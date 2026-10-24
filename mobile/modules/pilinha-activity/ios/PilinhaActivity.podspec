Pod::Spec.new do |s|
  s.name           = 'PilinhaActivity'
  s.version        = '0.1.0'
  s.summary        = 'Live Activity do Pilinha'
  s.author         = 'Pam Tech'
  s.homepage       = 'https://github.com/pamteech/pilinha'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.2' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'ActivityKit'
  s.source_files   = '**/*.swift'
end
