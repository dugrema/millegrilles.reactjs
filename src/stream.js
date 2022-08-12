// const { supporteFileStream } = require('./detecterAppareils')

/** Genere un reader pour le fichier (acceptedFile) */
export function getAcceptedFileReader(file) {
  // let reader = null

  // Utiliser detection pro-active, safari sur iOS plante en mode stream
  // pour fichiers larges.
  // BUG: reader.read() gele au hasard, trouver pourquoi
  const supporteStream = false // supporteFileStream()

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
  const TAILLE_BUFFER = opts.tailleBuffer || (64 * 1024)  // 256 kB par defaut
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
        transformBufferSize = 64 * 1024
  const transform = opts.transform
  try {
    let done, positionLecture = 0, positionEcriture = 0
    const bufferOutput = new Uint8Array(batchSize)
    while (true) {
        console.debug("streamAsyncIterable Call reader.read")
        let bufferInput = null
        try {
          const resultatLecture = await reader.read(transformBufferSize)
          if(resultatLecture.value) bufferInput = Buffer.from(resultatLecture.value)
          done = resultatLecture.done
          positionLecture = 0
        } catch(err) {
          console.error("streamAsyncIterable Erreur reader.read() : %O", err)
          throw err
        }

        console.debug("streamAsyncIterable Lecture (done?%s) len %s value %O", done, bufferInput?bufferInput.length:'NA', bufferInput)
        if(bufferInput) {
          while(positionLecture < bufferInput.length) {
            let outputBlock = null
            if(transform) {
                const tailleBlockChiffrage = Math.min(bufferInput.length - positionLecture, transformBufferSize)
                console.debug("Chiffrage block taille (position: %d): %O", positionLecture, tailleBlockChiffrage)
                outputBlock = await opts.transform(bufferInput.slice(positionLecture, tailleBlockChiffrage))
                positionLecture += tailleBlockChiffrage
                console.debug("Chiffrage block complete (position rendu : %d) : %O", positionLecture, tailleBlockChiffrage)
            } else {
                outputBlock = bufferInput
                positionLecture += bufferInput.length
            }

            // Ecrire output
            let positionOutput = 0
            while(outputBlock && positionOutput < outputBlock.length) {
              const tailleBlockEcriture = Math.min(bufferOutput.length - positionEcriture, outputBlock.length)
              bufferOutput.set(outputBlock.slice(positionOutput, tailleBlockEcriture), positionEcriture)
              positionEcriture += tailleBlockEcriture
              positionOutput += tailleBlockEcriture
              if(bufferOutput.length === positionEcriture) {
                // On yield le buffer d'output (plein)
                console.debug("Yield buffer output : %O", bufferOutput)
                yield bufferOutput
                positionEcriture = 0
              }
            }
          }
        }

        if(done) {
            console.debug("streamAsyncIterable Done, traitement final de %s bytes", positionEcriture)
            if(positionEcriture > 0) {
                console.debug("streamAsyncIterable yield final")
                yield bufferOutput.slice(0, positionEcriture)
            }
            // Invocation finale
            console.debug("streamAsyncIterable Termine apres yield")
            return
        }
    }
  } finally {
    reader.releaseLock()
  }
}

// module.exports = {getAcceptedFileReader, streamAsyncIterable}
