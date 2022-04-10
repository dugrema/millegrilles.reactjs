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
const constructeurSubtle = async (methode, algo) => {
    const hacheur = await methode()
    return {
        update: buffer => hacheur.update(buffer),
        finalize: () => hacheur.digest('binary'),
        digest: async buffer => window.crypto.subtle.digest(algo, buffer)
    }
}

const hacheurs = {
    // hash-wasm
    'sha256': () => constructeurSubtle(createSHA256, 'SHA-256'),
    'sha2-256': () => constructeurSubtle(createSHA256, 'SHA-256'),
    'sha512': () => constructeurSubtle(createSHA512, 'SHA-512'),
    'sha2-512': () => constructeurSubtle(createSHA512, 'SHA-512'),
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