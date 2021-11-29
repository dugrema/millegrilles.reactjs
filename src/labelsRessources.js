/* Trouve la meilleure image pour les conditions dans opts */
export function trouverLabelImage(imagesLabels, opts) {
    opts = opts || {}

    if(!imagesLabels || imagesLabels.length === 0) return  // Rien a faire
    if(imagesLabels.length === 1) return imagesLabels[0]   // Short circuit, 1 seul item

    // Copier la liste de labels (le tri modifie la liste)
    let imagesLabelsCopy = [...imagesLabels]
    // let imagesLabels = Object.keys(images)

    const supporteWebp = opts.supporteWebp || false
    if(!supporteWebp) {
        imagesLabelsCopy = imagesLabelsCopy.filter(item=>(item.indexOf('webp') === -1))
    }

    imagesLabelsCopy.sort(trierLabelsImages)

    return imagesLabelsCopy[0]
}

function trierLabelsImages(a, b) {
    if(a === b) return 0

    if(a === 'thumbnail') return 1
    if(b === 'thumbnail') return -1
    if(a === 'poster') return 1
    if(b === 'poster') return -1

    const [mimetypeA, resolutionA] = a.split(';')
    const typeImageA = mimetypeA.split('/').pop()
    const [mimetypeB, resolutionB] = b.split(';')
    const typeImageB = mimetypeB.split('/').pop()

    if(resolutionA !== resolutionB) {
        return resolutionB - resolutionA
    }

    if(typeImageA !== typeImageB) {
        // JPG va toujours a la fin (fallback)
        if(typeImageA === 'jpg') return 1
        if(typeImageB === 'jpg') return -1

        return typeImageA.localeCompare(typeImageB)  // Comparer texte des type d'image
    }

    return a.localeCompare(b)
}

/* Trouve le meilleur video pour les conditions dans opts */
export function trouverLabelVideo(videoLabels, opts) {
    opts = opts || {}

    if(!videoLabels || videoLabels.length === 0) return  // Rien a faire
    if(videoLabels.length === 1) return videoLabels[0]   // Short circuit, 1 seul item

    // Conserver les types video/ uniquement
    const supporteWebm = opts.supporteWebm || false
    videoLabels = videoLabels.filter(item=>{
        // Retirer video webm au besoin
        if(!supporteWebm && item.indexOf('/webm') !== -1) return false
        
        // Convserver video/ uniquement
        return item.indexOf('video/') === 0
    })

    videoLabels.sort(trierLabelsVideos)
    console.debug("Videos labels tries : %O", videoLabels)
    return videoLabels[0]
}

function trierLabelsVideos(a, b) {
    if(a === b) return 0

    const [mimetypeA, resolutionA, bitrateA] = a.split(';')
    const typeImageA = mimetypeA.split('/').pop()
    const [mimetypeB, resolutionB, bitrateB] = b.split(';')
    const typeImageB = mimetypeB.split('/').pop()

    if(resolutionA !== resolutionB) {
        return resolutionB - resolutionA
    }

    if(typeImageA !== typeImageB) {
        // MP4 va toujours a la fin (fallback)
        if(typeImageA === 'mp4') return 1
        if(typeImageB === 'mp4') return -1

        return typeImageA.localeCompare(typeImageB)  // Comparer texte des type d'image
    }

    if(bitrateA !== bitrateB) return bitrateB - bitrateA

    return a.localeCompare(b)
}
