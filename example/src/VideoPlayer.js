import React, {useState, useCallback} from 'react'
import { Container, Button } from 'react-bootstrap'
import { ModalViewer, trouverLabelImage, trouverLabelVideo } from '@dugrema/millegrilles.reactjs'

export default props => {

    const [showViewer, setShowViewer] = useState(false)
    const [tuuidSelectionne, setTuuidSelectionne] = useState('')

    const fichiers = preparerSample1()

    const showViewerAction = useCallback( async tuuid => {
        await setTuuidSelectionne(tuuid)
        setShowViewer(true)
    }, [setTuuidSelectionne, setShowViewer])

    return (
        <Container>
            <h1>Video player</h1>

            <AfficherSample fichiers={fichiers} showViewer={showViewerAction} />

            <ModalViewer 
                show={showViewer} 
                handleClose={()=>setShowViewer(false)} 
                fichiers={fichiers} 
                tuuidSelectionne={tuuidSelectionne}
            />

        </Container>
    )
}

function AfficherSample(props) {

    console.debug("AfficherSample PROPPYS : %O", props)

    const { fichiers, showViewer } = props

    return (
        <>
            <h2>Fichiers sample</h2>
            <ul>
                {fichiers.map(item=>{
                    return (
                        <li key={item.tuuid}>
                            <Button variant="secondary" onClick={()=>showViewer(item.tuuid)}>
                                {item.nom}
                            </Button>
                        </li>
                    )
                })}
            </ul>
        </>
    )
}

function preparerSample1() {
    return [
        {
            tuuid: 'p-403', mimetype: 'video/qt', nom: 'p-403_032.mov',
            loader: typeRessource => resLoader({
                poster: '/reactjs/files/p-403_032.poster.jpg', 
                'image/jpg;720': '/reactjs/files/p-403_032.720.jpg',
                'video/mp4;480;1000000': '/reactjs/files/p-403_032.480.mp4',
                original: '/files/p-403_032.mov'
            }, typeRessource) 
        },
        {
            tuuid: '005', mimetype: 'video/qt', nom: '005.mp4',
            loader: typeRessource => resLoader({
                poster: '/reactjs/files/p-403_032.poster.jpg', 
                'image/jpg;720': '/reactjs/files/p-403_032.720.jpg',
                'video/mp4;240;250000': '/reactjs/files/005_240.mp4',
                original: '/files/p-403_032.mov'
            }, typeRessource) 
        },
        {
            tuuid: '005-1', mimetype: 'video/qt', nom: '005_1.mp4',
            loader: typeRessource => resLoader({
                poster: '/reactjs/files/p-403_032.poster.jpg', 
                'image/jpg;720': '/reactjs/files/p-403_032.720.jpg',
                'video/mp4;240;250000': '/reactjs/files/005_1_240.mp4',
                original: '/files/p-403_032.mov'
            }, typeRessource) 
        },
        {
            tuuid: 'pasvid-1', mimetype: 'video/qt', nom: 'pasvid.mp4',
            loader: typeRessource => resLoader({
                poster: '/reactjs/files/p-403_032.poster.jpg', 
                'image/jpg;720': '/reactjs/files/p-403_032.720.jpg',
                // 'video/mp4;240;250000': '/reactjs/files/005_1_240.mp4',
                original: '/files/p-403_032.mov'
            }, typeRessource) 
        },
    ]
}

/* Donne acces aux ressources, selection via typeRessource. Chargement async. 
   Retourne { src } qui peut etre un url ou un blob. 
*/
function resLoader(sources, typeRessource, opts) {
    opts = opts || {}

    console.debug("Loader %s avec sources %O", typeRessource, sources)

    let src = ''
    if(typeRessource === 'image') {
        // Charger image pleine resolution
        const labelImage = trouverLabelImage(Object.keys(sources))
        console.debug("Label image trouve : '%s'", labelImage)
        src = Promise.resolve(sources[labelImage])
    } else if(typeRessource === 'poster') {
        // Charger poster (fallback image pleine resolution)
        if(sources.poster) src = sources.poster
        else {
            const labelImage = trouverLabelImage(Object.keys(sources))
            console.debug("Label image trouve : '%s'", labelImage)
            src = Promise.resolve(sources[labelImage])
        }
    } else if(typeRessource === 'thumbnail') {
        // Charger thumbnail (fallback image poster, sinon pleine resolution)
        if(sources.thumbnail) src = sources.thumbnail
        else if(sources.poster) src = sources.poster
        else {
            const labelImage = trouverLabelImage(Object.keys(sources))
            console.debug("Label image trouve : '%s'", labelImage)
            src = Promise.resolve(sources[labelImage])
        }
    } else if(typeRessource === 'video') {
        // Charger video pleine resolution
        const labelVideo = trouverLabelVideo(Object.keys(sources))
        console.debug("Label video trouve : '%s'", labelVideo)
        const urlVideo = sources[labelVideo]

        if(!urlVideo) return
        // src = new Promise(resolve=>{
        //     setTimeout(()=>resolve(sources[labelVideo]), 2000)
        // })

        src = new Promise(async (resolve, reject)=>{
            try {
                const response = await fetch(urlVideo)
                console.debug(response)
                const ab = await response.arrayBuffer()
                const blob = new Blob(
                    [ab], 
                    // {type: 'video/mp4'}
                )
                console.debug("AB : %O, Blob : %O", ab, blob)

                const blobUrl = URL.createObjectURL(blob)
                resolve(blobUrl)
            } catch(err) {
                reject(err)
            }
        })
    } else if(typeRessource === 'original') {
        // Charger contenu original
        src = Promise.resolve(sources.original)
    }

    return { srcPromise: src, clean: ()=>clean(src) }
}

function clean(src) {
    console.debug("Cleanup image %s", src)
    // URL.revokeObjectURL(blobUrl)
}