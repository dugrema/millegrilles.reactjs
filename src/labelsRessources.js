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
    // console.debug("Videos labels tries : %O", videoLabels)
    return videoLabels[0]
}

export function trierLabelsVideos(a, b) {
    if(a === b) return 0

    const [mimetypeA, codecVideoA, resolutionA, bitrateA] = a.split(';')
    const typeImageA = mimetypeA.split('/').pop()
    const [mimetypeB, codecVideoB, resolutionB, bitrateB] = b.split(';')
    const typeImageB = mimetypeB.split('/').pop()

    // Resolution est le trait le plus significatif
    if(resolutionA !== resolutionB) {
        const resolutionANumber = Number.parseInt(resolutionA)
        const resolutionBNumber = Number.parseInt(resolutionB)
        return resolutionBNumber - resolutionANumber
    }
    
    // Codec video est le 2e trait
    if(codecVideoA !== codecVideoB) {
        if(!codecVideoA) return -1
        if(!codecVideoB) return 1

        // VP9 va en premier (le plus discriminant)
        if(codecVideoA === 'vp9') return -1
        if(codecVideoB === 'vp9') return 1

        // HEVC va en deuxieme
        if(codecVideoA === 'hevc') return -1
        if(codecVideoB === 'hevc') return 1

        // Les autres vont dans l'ordre naturel
        return codecVideoA.localeCompare(codecVideoB)
    }

    if(typeImageA !== typeImageB) {
        // MP4 va toujours a la fin (fallback)
        if(typeImageA === 'mp4') return 1
        if(typeImageB === 'mp4') return -1

        return typeImageA.localeCompare(typeImageB)  // Comparer texte des type d'image
    }

    if(bitrateA !== bitrateB) {
        const bitrateANumber = Number.parseInt(bitrateA)
        const bitrateBNumber = Number.parseInt(bitrateB)
        return bitrateBNumber - bitrateANumber
    }

    return a.localeCompare(b)
}
