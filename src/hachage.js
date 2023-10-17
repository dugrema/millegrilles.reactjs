import {
    hacher, verifierHachage, 
    Hacheur, VerificateurHachage, 
    calculerDigest,
    hacherCertificat, comparerArraybuffers,
    setHacheurs, decoderHachage,
} from '@dugrema/millegrilles.utiljs/src/hachage'
import { createSHA256, createSHA512, createBLAKE2b, createBLAKE2s, blake2s, blake2b } from 'hash-wasm'
// import _sodium from 'libsodium-wrappers'

// Injecte les methodes de hachage natives avec setHacheurs pour la librairie utiljs

const constructeur = async (methode, methodeDigest) => {
    // const hacheur = await methode()
    let hacheur = null
    return {
        update: async buffer => {
            if(!hacheur) hacheur = await methode() // Initialiser le hacheur sur premiere utilisation
            hacheur.update(buffer)
        },
        finalize: () => hacheur.digest('binary'),
        digest: async buffer => { 
            // Tenter d'utiliser la version one-shot pour le digest
            if(methodeDigest) {
                const valeur = await methodeDigest(buffer)
                const valeurBin = Buffer.from(valeur, 'hex')
                // console.debug("Digest instantane : %O", valeurBin)
                return valeurBin
            }

            // One-shot non disponible. Generer le hacheur avec etat (stateful) et retourer le resultat.
            if(hacheur) await hacheur.init()  // Reset
            else hacheur = await methode()

            await hacheur.update(buffer)
            const valeur = await hacheur.digest('binary') 
            // console.debug("Digest long : %O", valeur)
            return valeur
        },
        reset: async () => {
            if(hacheur) await hacheur.init()
            else hacheur = await methode()
        }
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
    'blake2s256': () => constructeur(createBLAKE2s, blake2s),
    'blake2s-256': () => constructeur(createBLAKE2s, blake2s),
    'blake2b512': () => constructeur(createBLAKE2b, blake2b),
    'blake2b-512': () => constructeur(createBLAKE2b, blake2b),
}

// console.debug("Set hacheurs : %O", hacheurs)
setHacheurs(hacheurs)

export { 
    hacher, verifierHachage, 
    Hacheur, VerificateurHachage, 
    calculerDigest,
    hacherCertificat, comparerArraybuffers,
    decoderHachage,
    setHacheurs, 
    hacheurs,
}