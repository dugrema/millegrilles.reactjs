import { setHacheurs } from '@dugrema/millegrilles.utiljs'
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

export default {}