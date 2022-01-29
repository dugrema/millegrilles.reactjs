import { useEffect, useState } from 'react'
import { chiffrage } from '@dugrema/millegrilles.reactjs'
import { ed25519 } from '@dugrema/node-forge'

const TAILLE_CHIFFRAGE = 32  // 1 * 1024 * 1024 + 5

function ChiffrageWasm(props) {
    
    const [dureeChiffrage, setDureeChiffrage] = useState('')
    const [dureeChiffrageJs, setDureeChiffrageJs] = useState('')
    const [message, setMessage] = useState('')

    useEffect(()=>{
        console.debug("WASM Crypto charge")
        chiffrer(setDureeChiffrage, setDureeChiffrageJs, setMessage)
            .catch(err=>console.error("Erreur wasmcrypto chiffrer: %O", err))
    }, [])

    return (
        <div>
            <h1>Chiffrage librairie millegrilles.reactjs</h1>

            <p>Taille du contenu a chiffrer : {TAILLE_CHIFFRAGE}</p>

            <p>Duree WASM : {dureeChiffrage}</p>
            
            <p>Duree JS : {dureeChiffrageJs}</p>

            <p>{message}</p>

        </div>
    )
}

export default ChiffrageWasm

async function chiffrer(setDureeChiffrage, setDureeChiffrageJs, setMessage) {

    // await loaddeps()

    await setMessage("Debut chiffrage")

    await chiffrerWasmChacha20_onepass(setMessage)
    await chiffrerWasmChacha20(setDureeChiffrage, setMessage)

    await setMessage("Chiffrage termine")
}

async function chiffrerWasmChacha20_onepass(setMessage) {
    console.debug("Chiffrage ChaCha20 one pass")
    await setMessage("Chiffrage WASM one pass")

    const { publicKey } = ed25519.generateKeyPair()
    const publicKeyBytes = publicKey.publicKeyBytes

    const messageString = "Je veux chiffrer un message avec WASM puis faire la difference entre WASM et pur JavaScript."
    const encoder = new TextEncoder()
    let messageBytes = encoder.encode(messageString)
    // let messageBytes = new Uint8Array(1 * 1024 * 1024)

    console.debug("Debut chiffrage")
    const debut = new Date()

    const resultatChiffrage = await chiffrage.chiffrer(messageBytes, {clePubliqueEd25519: publicKeyBytes})
    const finChiffrage = new Date()
    const duree = finChiffrage.getTime() - debut.getTime()
    
    // console.debug("Resultat chiffrage: %O", resultatChiffrage)
    console.debug("Done chiffrage - duree %s ms", duree)

    const {ciphertext, secretKey, meta} = resultatChiffrage,
          {iv, tag} = meta
    const debutDechiffrage = new Date()
    const messageDechiffre = await chiffrage.dechiffrer(ciphertext, secretKey, iv, tag)
    const finDechiffrage = new Date()
    const dureeDechiffrage = finDechiffrage.getTime() - debutDechiffrage.getTime()

    // console.debug("Output dechiffrage : %O", messageDechiffre)
    const bufferDechiffre = Buffer.from(messageDechiffre)
    const textDecoder = new TextDecoder()
    const messageDechiffreString = textDecoder.decode(bufferDechiffre)

    console.debug("Done dechiffrage ChaCha20 - duree %s ms", dureeDechiffrage)
    // console.debug("Contenu dechiffre ChaCha20 : %s", messageDechiffreString)

}

const CHUNK_SIZE = 256 * 1024

async function chiffrerWasmChacha20(setDureeChiffrage, setMessage) {
    console.debug("Chiffrage ChaCha20")
    await setMessage("Chiffrage WASM")

    const { publicKey } = ed25519.generateKeyPair()
    const publicKeyBytes = publicKey.publicKeyBytes

    const messageString = "Je veux chiffrer un message avec WASM puis faire la difference entre WASM et pur JavaScript."
    const encoder = new TextEncoder()
    // let messageBytes = encoder.encode(messageString)
    let messageBytes = new Uint8Array(1 * 1024 * 1024)
    // console.debug("Message original : %O", messageBytes)

    // CHIFFRAGE

    console.debug("Debut chiffrage")
    const cipherInfo = await chiffrage.preparerCipher({clePubliqueEd25519: publicKeyBytes}),
          cipher = cipherInfo.cipher
    console.debug("Cipher info : %O", cipherInfo)

    const debut = new Date()
    let ciphertext = [], chunks = 0
    while(messageBytes.length > 0) {
        chunks++
        let chunk = messageBytes.slice(0, CHUNK_SIZE)
        messageBytes = messageBytes.slice(CHUNK_SIZE)
        let _ciphertext = await cipher.update(chunk)
        ciphertext = [...ciphertext, ..._ciphertext]
    }
    //console.debug("Ciphertext chiffre : %O", ciphertext)
    console.debug("Chiffrage avec %d chunks", chunks)
    const resultatChiffrage = await cipher.finalize()
    const finChiffrage = new Date()
    const duree = finChiffrage.getTime() - debut.getTime()

    console.debug("Resultat final : %O", resultatChiffrage)
    await setDureeChiffrage('Chiffrage : '+duree+' ms, Dechiffrage: NA')
    console.debug("Done chiffrage - duree %s ms", duree)

    if(resultatChiffrage.ciphertext) {
        ciphertext = Buffer.concat([ciphertext, resultatChiffrage.ciphertext])
        //console.debug("Ciphertext complet : %O", ciphertext)
    }

    // DECHIFFRAGE
    const key = cipherInfo.secretKey,
          nonce = cipherInfo.iv,
          tag = resultatChiffrage.tag
    const decipher = await chiffrage.preparerDecipher(key, nonce, {tag})
    console.debug("Decipher : %O", decipher)
    const debutDechiffrage = new Date()

    // let messageDechiffre = await decipher.update(ciphertext)
    let _messageDechiffre = []
    while(ciphertext.length > 0) {
        chunks++
        let chunk = ciphertext.slice(0, CHUNK_SIZE)
        ciphertext = ciphertext.slice(CHUNK_SIZE)
        let message = await decipher.update(chunk)
        _messageDechiffre = [..._messageDechiffre, ...message]
    }

    const resultatDechiffrage = await decipher.finalize()
    const finDechiffrage = new Date()

    const dureeDechiffrage = finDechiffrage.getTime() - debutDechiffrage.getTime()
    await setDureeChiffrage('Chiffrage : '+duree+' ms, Dechiffrage: ' + dureeDechiffrage + ' ms')
    //console.debug("Message dechiffre : %O\nResultat: %O", messageDechiffre, resultatDechiffrage)
    console.debug("Done dechiffrage ChaCha20 - duree %s ms", dureeDechiffrage)
}

const MESSAGE_1 = 'un message secret',
      KEY_1 = 'm7o6Oy11rqROwiWk/UgE1zq+UifXeMYdwecDhDZkjENo',
      NONCE_1 = 'mwbQUFbYMUR1f3eu5',
      CYPHERTEXT_1 = 'mTkvJw79bU02T7aVAMa2APm8xUs5Ao/9YX+n1gEqbXwfa'
