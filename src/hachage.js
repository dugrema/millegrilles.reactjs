import {
    hacher, verifierHachage, 
    Hacheur, VerificateurHachage, 
    calculerDigest,
    hacherCertificat, comparerArraybuffers,
    setHacheurs,
} from '@dugrema/millegrilles.utiljs/src/hachage'
import { createSHA256, createSHA512, createBLAKE2b, createBLAKE2s } from 'hash-wasm'

// Injecte les methodes de hachage natives avec setHacheurs pour la librairie utiljs

const constructeur = async methode => {
    const hacheur = await methode()
    return {
        update: buffer => hacheur.update(buffer),
        finalize: () => hacheur.digest('binary'),
        digest: async buffer => { await hacheur.update(buffer); return await hacheur.digest('binary') }
    }
}

// Utilise subtle pour digest() one shot et WASM pour blocks avec update/finalize
// const constructeurSubtle = async (methode, algo) => {
//     console.debug("Constructeur subtle methode %O, algo %O", methode, algo)
//     const hacheur = await methode()
//     console.debug("window %O, self %O", window, self)
//     let refHandle = window || self
//     return {
//         update: buffer => hacheur.update(buffer),
//         finalize: () => hacheur.digest('binary'),
//         digest: async buffer => refHandle.crypto.subtle.digest(algo, buffer)
//     }
// }

const hacheurs = {
    // hash-wasm
    'sha256': () => constructeur(createSHA256),
    'sha2-256': () => constructeur(createSHA256),
    'sha512': () => constructeur(createSHA512),
    'sha2-512': () => constructeur(createSHA512),
    'blake2s256': () => constructeur(createBLAKE2s),
    'blake2s-256': () => constructeur(createBLAKE2s),
    'blake2b512': () => constructeur(createBLAKE2b),
    'blake2b-512': () => constructeur(createBLAKE2b),
}

// console.debug("Set hacheurs : %O", hacheurs)
setHacheurs(hacheurs)

// export default {
//     hacher, verifierHachage, 
//     Hacheur, VerificateurHachage, 
//     calculerDigest,
//     hacherCertificat, comparerArraybuffers,
//     setHacheurs, 
//     hacheurs,
// }

export { 
    hacher, verifierHachage, 
    Hacheur, VerificateurHachage, 
    calculerDigest,
    hacherCertificat, comparerArraybuffers,
    setHacheurs, 
    hacheurs,
}