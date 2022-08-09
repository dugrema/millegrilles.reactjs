import { setCiphers } from '@dugrema/millegrilles.utiljs/src/chiffrage.ciphers'
import { Hacheur } from './hachage'
import { base64 } from 'multiformats/bases/base64'
import _sodium from 'libsodium-wrappers'

// S'assurer de charger les methodes de hachage
// import ('./hachage')

const OVERHEAD_MESSAGE = 17,
      DECIPHER_MESSAGE_SIZE = 64 * 1024,
      MESSAGE_SIZE = DECIPHER_MESSAGE_SIZE - OVERHEAD_MESSAGE

export async function creerStreamCipherXChacha20Poly1305(key, opts) {
    opts = opts || {}
    const digestAlgo = opts.digestAlgo || 'blake2b-512'
    const messageBuffer = new Uint8Array(MESSAGE_SIZE)
    let positionBuffer = 0,
        tailleOutput = 0

    // Preparer libsodium, hachage (WASM)
    const hacheur = new Hacheur({hashingCode: digestAlgo})
    await hacheur.ready
    await _sodium.ready
    const sodium = _sodium

    // Preparer cipher
    const res = sodium.crypto_secretstream_xchacha20poly1305_init_push(key)
    const state_out = res.state
    const header = base64.encode(new Uint8Array(res.header))
    
    let hachage = null
    return {
        update: async data => {
            data = Uint8Array.from(data)
            let ciphertext = null

            // Chiffrer tant qu'on peut remplir le buffer
            while (positionBuffer + data.length >= MESSAGE_SIZE) {
                // Slice data
                let endPos = MESSAGE_SIZE - positionBuffer
                messageBuffer.set(data.slice(0, endPos), positionBuffer)
                data = data.slice(endPos)

                // Chiffrer
                let ciphertextMessage = sodium.crypto_secretstream_xchacha20poly1305_push(
                    state_out, messageBuffer, null, sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE)
                if(ciphertextMessage === false) throw new CipherError('Erreur encodage')
                if(!ciphertext) ciphertext = ciphertextMessage
                else ciphertext = new Uint8Array([...ciphertext, ...ciphertextMessage])

                positionBuffer = 0  // Reset position
            }

            // Inserer data restant dans le buffer
            if(positionBuffer + data.length <= MESSAGE_SIZE) {
                messageBuffer.set(data, positionBuffer)
                positionBuffer += data.length
            }
            
            if(ciphertext) {
                await hacheur.update(ciphertext)
                tailleOutput += ciphertext.length
            }

            return ciphertext
        },
        finalize: async () => {
            let ciphertextMessage = sodium.crypto_secretstream_xchacha20poly1305_push(
                state_out, messageBuffer.slice(0,positionBuffer), null, sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL)
            if(ciphertextMessage === false) throw new CipherError('Erreur encodage')
            
            await hacheur.update(ciphertextMessage)
            tailleOutput += ciphertextMessage.length
            hachage = await hacheur.finalize()

            return {header, hachage, taille: tailleOutput, ciphertext: ciphertextMessage}
        },
        header: () => header,
        hachage: () => hachage,
    }
}

export async function creerStreamDecipherXChacha20Poly1305(headerStr, keyStr) {
    const messageBuffer = new Uint8Array(DECIPHER_MESSAGE_SIZE)
    let positionBuffer = 0,
        tailleOutput = 0

    // Preparer libsodium (WASM)
    await _sodium.ready
    const sodium = _sodium

    const key = typeof(keyStr)==='string'?base64.decode(keyStr):keyStr,
          header = typeof(headerStr)==='string'?base64.decode(headerStr):headerStr

    // Preparer decipher
    const state_in = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, key)

    return {
        update: async data => {
            data = Uint8Array.from(data)
            let message = null

            // Chiffrer tant qu'on peut remplir le buffer
            while (positionBuffer + data.length >= DECIPHER_MESSAGE_SIZE) {
                // Slice data
                let endPos = DECIPHER_MESSAGE_SIZE - positionBuffer
                messageBuffer.set(data.slice(0, endPos), positionBuffer)
                data = data.slice(endPos)

                // Dechiffrer
                const resultatDechiffrage = sodium.crypto_secretstream_xchacha20poly1305_pull(state_in, messageBuffer)
                if(resultatDechiffrage === false) throw new DecipherError('Erreur dechiffrage')

                if(!message) message = resultatDechiffrage.message
                else message = new Uint8Array([...message, ...resultatDechiffrage.message])

                positionBuffer = 0  // Reset position
            }

            // Inserer data restant dans le buffer
            if(positionBuffer + data.length <= DECIPHER_MESSAGE_SIZE) {
                messageBuffer.set(data, positionBuffer)
                positionBuffer += data.length
            }
            
            if(message) {
                tailleOutput += message.length
            }

            return message
        },
        finalize: async () => {
            let decipheredMessage
            if(positionBuffer) {
                const resultat = sodium.crypto_secretstream_xchacha20poly1305_pull(state_in, messageBuffer.slice(0,positionBuffer))
                if(resultat === false) throw new DecipherError('Erreur dechiffrage')
                const {message, tag} = resultat
                decipheredMessage = message
                tailleOutput += decipheredMessage.length
            }
            return {taille: tailleOutput, message: decipheredMessage}
        }
    }
}

/**
 * One pass encrypt ChaCha20Poly1305.
 * @param {*} key 
 * @param {*} nonce 
 * @param {*} data 
 * @param {*} opts 
 */
export async function encryptStreamXChacha20Poly1305(key, data, opts) {
    const cipher = await creerStreamCipherXChacha20Poly1305(key, opts)

    // Creer buffer pour resultat
    const tailleBuffer = (Math.ceil(data.length / MESSAGE_SIZE) + 1) * DECIPHER_MESSAGE_SIZE
    const buffer = new Uint8Array(tailleBuffer)
    let positionLecture = 0, positionEcriture = 0

    while(positionLecture < data.length) {
        const tailleLecture = Math.min(data.length - positionLecture, MESSAGE_SIZE)
        const dataSlice = data.slice(positionLecture, positionLecture+tailleLecture)
        const output = await cipher.update(dataSlice)
        if(output) {
            buffer.set(output, positionEcriture)
            positionEcriture += output.length
        }

        positionLecture += tailleLecture
    }
    let {ciphertext, header, hachage} = await cipher.finalize()

    if(ciphertext) {
        // Concatener
        buffer.set(ciphertext, positionEcriture)
        positionEcriture += ciphertext.length
    }

    return {ciphertext: buffer.slice(0, positionEcriture), header, hachage}
}

/**
 * One pass decrypt stream XChaCha20Poly1305.
 * @param {*} key 
 * @param {*} nonce 
 * @param {*} data 
 * @param {*} tag 
 * @param {*} opts 
 */
export async function decryptStreamXChacha20Poly1305(header, key, ciphertext, opts) {
    const decipher = await creerStreamDecipherXChacha20Poly1305(header, key, opts)

    // Creer buffer pour resultat
    const tailleBuffer = Math.ceil(ciphertext.length / DECIPHER_MESSAGE_SIZE) * MESSAGE_SIZE
    const buffer = new Uint8Array(tailleBuffer)
    let positionLecture = 0, positionEcriture = 0

    while(positionLecture < ciphertext.length) {
        const tailleLecture = Math.min(ciphertext.length - positionLecture, DECIPHER_MESSAGE_SIZE)
        const cipherSlice = ciphertext.slice(positionLecture, positionLecture+tailleLecture)
        const output = await decipher.update(cipherSlice)
        if(output) {
            buffer.set(output, positionEcriture)
            positionEcriture += output.length
        }

        positionLecture += tailleLecture
    }
    let {message} = await decipher.finalize()

    if(message) {
        // Concatener
        buffer.set(message, positionEcriture)
        positionEcriture += message.length
    }

    return buffer.slice(0, positionEcriture)
}

async function creerReadableStream() {

    let readableStream = null
    const controller = await new Promise(resolve => {
        readableStream = new ReadableStream({
            start: controller => {
                resolve(controller)
            },
        })
    })

    return {controller, stream: readableStream}
}

export class CipherError extends Error {}

export class DecipherError extends Error {}

const ciphers = {
    // Nodejs Crypto
    'stream-xchacha20poly1305': {
        encrypt: encryptStreamXChacha20Poly1305,
        decrypt: decryptStreamXChacha20Poly1305,
        getCipher: creerStreamCipherXChacha20Poly1305,
        getDecipher: creerStreamDecipherXChacha20Poly1305,
        messageSize: MESSAGE_SIZE,
    }
}

setCiphers(ciphers)
