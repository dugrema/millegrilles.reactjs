import { setCiphers } from '@dugrema/millegrilles.utiljs/src/chiffrage.ciphers'
import { hacher, Hacheur } from './hachage'
import { base64 } from 'multiformats/bases/base64'
import _sodium from 'libsodium-wrappers'

// S'assurer de charger les methodes de hachage
// import ('./hachage')

const MESSAGE_SIZE = 64 * 1024,
      OVERHEAD_MESSAGE = 17,
      DECIPHER_MESSAGE_SIZE = MESSAGE_SIZE + OVERHEAD_MESSAGE

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

    console.debug("Header : %O, Key : %O", header, key)

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
                console.debug("Dechiffrer : %O", messageBuffer)
                const resultatDechiffrage = sodium.crypto_secretstream_xchacha20poly1305_pull(state_in, messageBuffer)
                console.debug("Resultat dechiffrage : %O", resultatDechiffrage)
                if(!message) message = resultatDechiffrage.message
                else message = new Uint8Array([...message, ...resultatDechiffrage.message])
                console.debug("Message : %O", message)

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
                console.debug("Dechiffrer : %O (taille: %d)", messageBuffer, positionBuffer)
                const {message, tag} = sodium.crypto_secretstream_xchacha20poly1305_pull(state_in, messageBuffer.slice(0,positionBuffer))
                console.debug("Output final : %O", message)
                decipheredMessage = message
                tailleOutput += decipheredMessage.length
            }
            return {taille: tailleOutput, message: decipheredMessage}
        }
    }
}

// async function creerCipherChacha20Poly1305(key, nonce, opts) {
//     opts = opts || {}
//     const digestAlgo = opts.digestAlgo || 'blake2b-512'

//     // Preparer input et output streams
//     const wasmcrypto = await importWasmCrypto()
//     const {controller: controllerInput, stream: streamInput} = await creerReadableStream()
//     const {controller: controllerOutput, stream: streamOutput} = await creerReadableStream()
//     const readerInput = await streamInput.getReader()
//     const readerOutput = await streamOutput.getReader()

//     // Creer interface du readerInput pour faire feed en Uint8Array
//     const readerInterface = {
//         read: async () => {
//             const input = await readerInput.read()
//             if(input.done) return input
//             const value = [...new Uint8Array(input.value)]
//             return {done: false, value}
//         }
//     }

//     const output = {
//         write: async chunk => {
//             // console.debug("Recu chunk chiffre %O", chunk)
//             controllerOutput.enqueue(chunk)
//             return true
//         },
//         close: async () => {
//             controllerOutput.close()
//             // console.debug("Output closed")
//             return true
//         }
//     }
    
//     // console.debug("Controller: %O\nstream: %O\nreader: %O", controllerInput, streamInput, readerInput)

//     // Preparer cipher (WASM)
//     const asyncCipher = wasmcrypto.chacha20poly1305_encrypt_stream(nonce, key, readerInterface, output)

//     // Preparer hachage (WASM)
//     const hacheur = new Hacheur({hashingCode: digestAlgo})
//     await hacheur.ready
//     let tag = null, hachage = null, taille = 0
//     let _done = false

//     return {
//         update: async data => {
//             // console.debug("Data enqueue : %O", data)
//             controllerInput.enqueue(data)

//             // Lire une "chunk" en output pour simuler sync
//             let {done, value: ciphertext} = await readerOutput.read()
//             // console.debug("Resultat : done %s, ciphertext: %O", done, ciphertext)
//             if(!done) {
//                 ciphertext = new Uint8Array(ciphertext)
//                 // console.debug("ciphertext output lu : %O", ciphertext)
//                 await hacheur.update(ciphertext)
//                 taille += ciphertext.length
//             } else {
//                 _done = true
//             }

//             return ciphertext
//         },
//         finalize: async () => {
//             // console.debug("Finalize")
//             controllerInput.close()

//             let ciphertext = null
//             if(!_done) {
//                 ciphertext = []
//                 let output = await readerOutput.read()
//                 while(!output.done) {
//                     ciphertext = [...ciphertext, ...output.value]
//                     output = await readerOutput.read()
//                 }
//             }
//             if(ciphertext.length === 0) ciphertext = null
//             else {
//                 ciphertext = new Uint8Array(ciphertext)
//                 await hacheur.update(ciphertext)
//             }

//             hachage = await hacheur.finalize()
//             tag = await asyncCipher
//             // console.debug("Tag : %O", tag)
//             tag = base64.encode(new Uint8Array(tag))

//             return {tag, hachage, taille, ciphertext}
//         },
//         tag: () => tag,
//         hachage: () => hachage,
//     }
// }

// async function creerDecipherChacha20Poly1305(key, nonce, opts) {
//     opts = opts || {}

//     let tag = opts.tag
//     if(!tag) throw new Error("Il faut fournir opts.tag pour cet algorithme")
//     if(typeof(tag) === 'string') tag = base64.decode(tag)

//     const wasmcrypto = await importWasmCrypto()

//     // Preparer input et output streams
//     const {controller: controllerInput, stream: streamInput} = await creerReadableStream()
//     const {controller: controllerOutput, stream: streamOutput} = await creerReadableStream()
//     const readerInput = await streamInput.getReader()
//     const readerOutput = await streamOutput.getReader()

//     // Creer interface du readerInput pour faire feed en Uint8Array
//     const readerInterface = {
//         read: async () => {
//             const input = await readerInput.read()
//             if(input.done) return input
//             // Convert input to array
//             const value = [...input.value]
//             return {done: false, value}
//         }
//     }

//     const output = {
//         write: async chunk => {
//             // console.debug("Recu chunk chiffre %O", chunk)
//             controllerOutput.enqueue(chunk)
//             return true
//         },
//         close: async () => {
//             controllerOutput.close()
//             // console.debug("Output closed")
//             return true
//         }
//     }

//     // Preparer cipher (WASM)
//     const asyncDecipher = wasmcrypto.chacha20poly1305_decrypt_stream(nonce, key, tag, readerInterface, output)

//     let _done = false

//     return {
//         update: async data => {
//             controllerInput.enqueue(data)
//             // console.debug("Data enqueue : %O", data)

//             // Lire une "chunk" en output pour simuler sync
//             let {done, value: message} = await readerOutput.read()
//             if(!done) {
//                 message = new Uint8Array(message)
//                 // console.debug("ciphertext output lu : %O", ciphertext)
//             } else {
//                 _done = true
//             }

//             return message
//         },
//         finalize: async () => {
//             // console.debug("Finalize")
//             controllerInput.close()

//             let message = null
//             if(!_done) {
//                 message = []
//                 let output = await readerOutput.read()
//                 while(!output.done) {
//                     message = [...message, ...output.value]
//                     output = await readerOutput.read()
//                 }
//             }
//             if(message.length === 0) message = null
//             else {
//                 message = new Uint8Array(message)
//             }

//             await asyncDecipher  // Attendre la verification du tag
            
//             return message
//         },
//     }

// }

// /**
//  * One pass encrypt ChaCha20Poly1305.
//  * @param {*} key 
//  * @param {*} nonce 
//  * @param {*} data 
//  * @param {*} opts 
//  */
// async function encryptChacha20Poly1305(key, nonce, data, opts) {
//     const wasmcrypto = await importWasmCrypto()
//     const ciphertextTag = await wasmcrypto.chacha20poly1305_encrypt(nonce, key, data)
//     const ciphertext = Buffer.from(ciphertextTag.slice(0, ciphertextTag.length-16))
//     const tag = Buffer.from(ciphertextTag.slice(ciphertextTag.length-16))

//     // Hacher contenu chiffre
//     const hachage = await hacher(ciphertext, opts)

//     return {ciphertext, tag, hachage}
// }

// /**
//  * One pass decrypt ChaCha20Poly1305.
//  * @param {*} key 
//  * @param {*} nonce 
//  * @param {*} data 
//  * @param {*} tag 
//  * @param {*} opts 
//  */
// async function decryptChacha20Poly1305(key, nonce, data, tag, opts) {
//     const wasmcrypto = await importWasmCrypto()
//     if(typeof(tag)==='string') tag = base64.decode(tag)
//     if(typeof(nonce)==='string') nonce = base64.decode(nonce)

//     //if(Buffer.isBuffer(tag)) tag = Buffer.from(tag)
//     //if(Buffer.isBuffer(data)) data = Buffer.from(data)
//     if(Buffer.isBuffer(nonce)) nonce = Buffer.from(nonce)
//     data = Buffer.from(data)
//     tag = Buffer.from(tag)
//     // console.debug("Data: %O, tag: %O", data, tag)
//     const ciphertextTag = new Uint8Array(Buffer.concat([data, tag]))
//     // console.debug("ciphertextTag : %O", ciphertextTag)

//     try {
//         const messageDechiffre = await wasmcrypto.chacha20poly1305_decrypt(nonce, key, ciphertextTag)
//         return messageDechiffre
//     } catch(err) {
//         console.error("decryptChacha20Poly1305 Erreur call WASM : %O", err)
//         throw err
//     }
// }

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

const ciphers = {
    // Nodejs Crypto
    'stream-xchacha20poly1305': {
        encrypt: creerStreamCipherXChacha20Poly1305,
//         decrypt: decryptChacha20Poly1305,
//         getCipher: creerCipherChacha20Poly1305,
//         getDecipher: creerDecipherChacha20Poly1305,
//         messageSize: 64*1024,
    }
}

setCiphers(ciphers)
