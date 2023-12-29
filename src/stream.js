// const { supporteFileStream } = require('./detecterAppareils')

/** Genere un reader pour le fichier (acceptedFile) */
export function getAcceptedFileReader(file) {
  // let reader = null

  // Utiliser detection pro-active, safari sur iOS plante en mode stream
  // pour fichiers larges.
  // BUG: reader.read() gele au hasard, trouver pourquoi
  const supporteStream = false // supporteFileStream()

  if(file.readable) return file.readable.getReader()

  if(supporteStream) {
    try {
      // Tenter d'utiliser le stream pour l'upload
      const stream = file.stream()
      const reader = stream.getReader()
      // console.debug("Utilisation stream.getReader()")
      return reader
    } catch(err) {
      // Echec stream, tenter de proceder par slice
    }
  }

  // reader.read retourne : {done, value}
  return sliceReader(file)
}

/** Simulacre de reader qui utilise plusieurs appels a blob.slice */
function sliceReader(file, opts) {
  opts = opts || {}
  const TAILLE_BUFFER = opts.tailleBuffer || (64 * 1024)  // 64 kB par defaut
  // const tailleFichier = file.size

  var position = 0
  var done = false
  const read = async (len) => {
    const tailleBuffer = len || TAILLE_BUFFER

    // console.debug("sliceReader Read invoque, position %d, done %s", position, done)
    done = position === file.size
    if(done) return {done, value: null}

    const positionFin = Math.min(position + tailleBuffer, file.size)
    const blob = file.slice(position, positionFin)
    const arrayBuffer = await blob.arrayBuffer()

    // Preparer pour prochaine iteration
    position = positionFin

    return {done: false, value: arrayBuffer}
  }
  const releaseLock = () => {return}

  return {read, releaseLock}
}

/**
 * opts : {
 *    batchSize,
 *    transform(value)->value
 * }
 */
export async function* streamAsyncIterable(reader, opts) {
  opts = opts || {}
  const batchSize = opts.batchSize || 1 * 1024 * 1024,
        transformBufferSize = opts.transformBufferSize || 64 * 1024
  const transform = opts.transform
  const transformBufferEffectiveSize = Math.min(transformBufferSize, batchSize)
  try {
    let done, positionLecture = 0, positionBufferOutput = 0
    const bufferOutput = new Uint8Array(batchSize)
    const transformUpdate = transform?(transform.update || transform):null
    const transformFinalize = transform?transform.finalize:null
    // console.debug("Transform update : ", transformUpdate)
    // console.debug("Transform finalize : ", transformFinalize)
    while (true) {
        // console.debug("streamAsyncIterable Call reader.read")
        let bufferInput = null
        try {
          const resultatLecture = await reader.read(transformBufferEffectiveSize)
          if(resultatLecture.value) bufferInput = Buffer.from(resultatLecture.value)
          done = resultatLecture.done
          positionLecture = 0
        } catch(err) {
          console.error("streamAsyncIterable Erreur reader.read() : %O", err)
          throw err
        }

        // console.debug("streamAsyncIterable Lecture (done?%s) len %s value %O", done, bufferInput?bufferInput.length:'NA', bufferInput)
        if(bufferInput) {
          while(positionLecture < bufferInput.length) {
            let outputBlock = null  // Chunk d'output
            if(transformUpdate) {
                const tailleBlockChiffrage = Math.min(bufferInput.length - positionLecture, transformBufferEffectiveSize)
                // console.debug("Chiffrage block taille (position: %d) %d, buffer input %d", positionLecture, tailleBlockChiffrage, bufferInput.length)
                outputBlock = await transformUpdate(bufferInput.slice(positionLecture, tailleBlockChiffrage))
                positionLecture += tailleBlockChiffrage
                // console.debug("Chiffrage block complete (position rendu : %d) output block len", positionLecture, outputBlock?outputBlock.length:0)
            } else {
                outputBlock = bufferInput
                positionLecture += bufferInput.length
            }

            // Ecrire output
            let positionOutputBlock = 0  // Position dans le chunk traite
            while(outputBlock && positionOutputBlock < outputBlock.length) {
              const tailleBlockEcriture = Math.min(bufferOutput.length - positionBufferOutput, outputBlock.length)
              bufferOutput.set(outputBlock.slice(positionOutputBlock, tailleBlockEcriture), positionBufferOutput)
              positionBufferOutput += tailleBlockEcriture
              positionOutputBlock += tailleBlockEcriture
              // console.debug("Ecriture output, bufferOutput len %d, position ecriture %d", bufferOutput.length, positionBufferOutput)
              if(bufferOutput.length === positionBufferOutput) {
                // On yield le buffer d'output (plein)
                // console.debug("Yield buffer output : %O", bufferOutput)
                const bufferOutputCopie = new Uint8Array(batchSize)
                // Copier le buffer pour retourner le contenu
                bufferOutputCopie.set(bufferOutput)
                yield bufferOutputCopie
                positionBufferOutput = 0
              }
            }
          }
        }

        if(done) {
            if(transformFinalize) {
              // Dernier block
              // console.debug("Dernier block lu, finalizing transform")
              const outputBlockFinalize = await transformFinalize()
              // console.debug("OutputBlock finalize ", outputBlockFinalize)
              if(outputBlockFinalize) {
                const outputBlock = outputBlockFinalize.ciphertext || outputBlockFinalize

                // console.debug("Ajout ciphertext ", outputBlock)
                let positionOutputBlock = 0  // Position dans le chunk traite
                while(outputBlock && positionOutputBlock < outputBlock.length) {
                  const tailleBlockEcriture = Math.min(bufferOutput.length - positionBufferOutput, outputBlock.length)
                  bufferOutput.set(outputBlock.slice(positionOutputBlock, tailleBlockEcriture), positionBufferOutput)
                  positionBufferOutput += tailleBlockEcriture
                  positionOutputBlock += tailleBlockEcriture
                  // console.debug("Ecriture output, bufferOutput len %d, position ecriture %d", bufferOutput.length, positionBufferOutput)
                  if(bufferOutput.length === positionBufferOutput) {
                    // On yield le buffer d'output (plein)
                    // console.debug("Yield buffer output : %O", bufferOutput)
                    const bufferOutputCopie = new Uint8Array(batchSize)
                    // Copier le buffer pour retourner le contenu
                    bufferOutputCopie.set(bufferOutput)
                    yield bufferOutputCopie
                    positionBufferOutput = 0
                  }
                }
              }
            }

            // console.debug("streamAsyncIterable Done, traitement final de %s bytes", positionBufferOutput)
            if(positionBufferOutput > 0) {
                // console.debug("streamAsyncIterable yield final")
                const bufferOutputCopie = new Uint8Array(positionBufferOutput)
                bufferOutputCopie.set(bufferOutput.slice(0, positionBufferOutput))
                // yield bufferOutput.slice(0, positionBufferOutput)
                yield bufferOutputCopie
            }
            // Invocation finale
            // console.debug("streamAsyncIterable Termine apres yield")
            return
        }
    }
  } finally {
    reader.releaseLock()
  }
}

// module.exports = {getAcceptedFileReader, streamAsyncIterable}
