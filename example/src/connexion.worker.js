import { expose } from 'comlink'
import { ConnexionClient } from '@dugrema/millegrilles.reactjs'
// Exposer methodes du Worker
expose(ConnexionClient)