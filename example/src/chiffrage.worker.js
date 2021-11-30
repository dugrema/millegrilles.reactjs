import { expose as comlinkExpose } from 'comlink'
// import { chiffrage } from '@dugrema/millegrilles.utiljs'
import { ChiffrageClient } from '@dugrema/millegrilles.reactjs'

// function test() {
//     console.debug("Test")
//     console.debug("Chiffrage info : %O", ChiffrageClient)
// }

// Re-exporter toutes les fonctions du worker
comlinkExpose(ChiffrageClient)

// export default {test}


// import { expose as comlinkExpose } from 'comlink'
// import { ChiffrageClient } from '@dugrema/millegrilles.reactjs'

// // Re-exporter toutes les fonctions du worker
// comlinkExpose(ChiffrageClient)
