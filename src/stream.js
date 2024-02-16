export function getAcceptedFileStream(file) {
  if(file.readable) return file.readable
  // Tenter d'utiliser le stream pour l'upload
  return file.stream()
}

/**
 * Transforme un reader en async iterable (for await ... of). Fonctionne sur tous les navigateurs. 
 * Note : Firefox peut deja utilise un stream comme async iterable, mais c'est le seul navigateur avec ce support.
 * @param {*} reader 
 * @param {*} opts 
 */
export async function* streamAsyncReaderIterable(reader, opts) {
  try {
    while(true) {
      const result = await reader.read()
      if(result.value) yield result.value   // Yield
      if(result.done) return                // Done
    }
  } finally {
    reader.releaseLock()
  }
}

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
 * Genere un transform stream qui appelle transformer.update sur chaque chunk et appelle transformer.flush a la fin.
 * Les fonctions update et flush peuvent retourner des promises.
 * @param {*} transformer 
 * @returns 
 */
export function createTransformStreamCallback(transformer) {
  // Demander un high watermark de 10 buffers de 64kb (64kb est la taille du buffer de chiffrage)
  // const queueingStrategy = new ByteLengthQueuingStrategy({ highWaterMark: 1024 * 64 * 10 })
  const queueingStrategy = new CountQueuingStrategy({ highWaterMark: 1 })

  if(!transformer || !transformer.transform) throw new Error('transformer sans .transform')

  return new TransformStream({
    async transform(chunk, controller) {
      if(!chunk || chunk.length === 0) return controller.error("Aucun contenu")

      // console.debug("createTransformStreamCallback chunk size %d", chunk.length)

      try {
        const sousBlockOutput = await transformer.transform(chunk)
        if(sousBlockOutput) controller.enqueue(sousBlockOutput)
      } catch(err) {
        controller.error(err)
      }

    },
    async flush(controller) {
      // console.debug("createTransformStreamCallback Close stream (transformer: %O, controller: %O)", transformer, controller)

      if(transformer.flush) {
        const value = await transformer.flush()
        const chunk = value.ciphertext || value.message
        if(chunk && chunk.length > 0) {
          controller.enqueue(chunk)
        }
      }

      return controller.terminate()
    }
  }, queueingStrategy, queueingStrategy)
}

/**
 * Generer un transformer qui fait un enqueue lorsque le buffer de taille batchSize est plein.
 * Retourne un buffer partiel uniquement lors du flush final.
 * @param {*} batchSize 
 * @returns 
 */
export function createTransformBatch(batchSize) {
  if(!batchSize) return new Error("batchSize invalide")

  // const queueingStrategy = new ByteLengthQueuingStrategy({ highWaterMark: 2 * batchSize })
  const queueingStrategy = new CountQueuingStrategy({ highWaterMark: 1 })

  const buffer = new Uint8Array(batchSize)
  let position = 0

  return new TransformStream({
    transform(chunk, controller) {
      if(!chunk || chunk.length === 0) return controller.error("Aucun contenu")

      // console.debug("createTransformBatch chunk size %d", chunk.length)

      while(chunk.length > 0) {
        let nextPosition = position + chunk.length

        if(nextPosition < batchSize) {
          buffer.set(chunk, position)
          position = nextPosition
          break  // Done
        } else {
          // Slice chunk
          const disponible = batchSize - position
          buffer.set(chunk.slice(0, disponible), position)
  
          // Remettre le reste de la chunk dans le buffer
          chunk = chunk.slice(disponible)
  
          // Copier buffer et enqeuue
          const copieBuffer = new Uint8Array(batchSize)
          copieBuffer.set(buffer)
          controller.enqueue(copieBuffer)
          position = 0
        }
      }
    },
    flush(controller) {
      if(position > 0) controller.enqueue(buffer.slice(0, position))
      controller.terminate()
    }
  }, queueingStrategy, queueingStrategy)
}
