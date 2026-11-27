const path=require('node:path');
const {getDefaultConfig}=require('expo/metro-config');
const root=path.resolve(__dirname,'../../../..');
const config=getDefaultConfig(__dirname);
config.watchFolders=[root];
config.resolver.nodeModulesPaths=[path.join(root,'node_modules')];
module.exports=config;
