import { expose } from 'comlink'
import * as ConnexionClient from '@dugrema/millegrilles.reactjs/src/connexionClient'
// Exposer methodes du Worker
expose(ConnexionClient)