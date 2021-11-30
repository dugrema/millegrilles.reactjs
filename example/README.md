This example was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

It is linked to the millegrilles.reactjs package in the parent directory for development purposes.

You can run `npm install` and then `npm start` to test your package.

# Configuration web workers

Instructions pour ajouter des web workers a un projet react.

* npm install --save-dev comlink worker-loader rescript-worker-loader @rescripts/cli
* Ajouter fichier .rescriptsrc.js au projet
* Creer un fichier *.worker.js par web worker a creer
* Dans chaque web worker, importer le code et reexporter avec comlink.expose
```
   import { expose } from 'comlink'
   import { ChiffrageClient } from '@dugrema/millegrilles.reactjs'
   expose(ChiffrageClient)
```
* Importer le web-worker dans un loader. Voir workerLoader.js.
* Changer script start et build pour rescripts start, rescripts build
