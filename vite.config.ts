import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{watch:{ignored:['**/public/library/**']},host:'127.0.0.1',port:5188,strictPort:true,proxy:{'/api':'http://127.0.0.1:5189','/library':'http://127.0.0.1:5189'}}});
