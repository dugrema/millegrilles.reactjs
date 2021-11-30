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
            <h1>Previews</h1>

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
            tuuid: 'abcd-1234', mimetype: 'image/jpeg', nom: '001.jpg',
            loader: typeRessource => resLoader({
                thumbnail: '/reactjs/res/001_128.jpg', 
                poster: '/reactjs/res/001_200.jpg', 
                'image/jpg;1080': '/reactjs/res/001.jpg',
                original: '/reactjs/res/001.jpg',
            }, typeRessource) 
        },
        {
            tuuid: 'abcd-1235', mimetype: 'application/pdf', nom: 'sample1.pdf',
            loader: typeRessource => resLoader({
                poster: '/reactjs/files/sample1.poster.jpg', 
                'image/jpg;700': '/reactjs/files/sample1.700.jpg',
                original: '/reactjs/files/sample1.pdf',
            }, typeRessource) 
        },
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
            tuuid: 'abcd-1236', mimetype: 'text/plain', nom: 'sampleTexte.txt',
            loader: typeRessource => resLoader({
                original: '/reactjs/files/sampleTexte.txt'
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
        src = sources[labelImage]
    } else if(typeRessource === 'poster') {
        // Charger poster (fallback image pleine resolution)
        if(sources.poster) src = sources.poster
        else {
            const labelImage = trouverLabelImage(Object.keys(sources))
            console.debug("Label image trouve : '%s'", labelImage)
            src = sources[labelImage]
        }
    } else if(typeRessource === 'thumbnail') {
        // Charger thumbnail (fallback image poster, sinon pleine resolution)
        if(sources.thumbnail) src = sources.thumbnail
        else if(sources.poster) src = sources.poster
        else {
            const labelImage = trouverLabelImage(Object.keys(sources))
            console.debug("Label image trouve : '%s'", labelImage)
            src = sources[labelImage]
        }
    } else if(typeRessource === 'video') {
        // Charger video pleine resolution
        const labelVideo = trouverLabelVideo(Object.keys(sources))
        console.debug("Label video trouve : '%s'", labelVideo)
        src = new Promise(resolve=>{
            setTimeout(()=>resolve(sources[labelVideo]), 2000)
        })
    } else if(typeRessource === 'original') {
        // Charger contenu original
        src = sources.original
    }

    return { srcPromise: (async () => src)(), clean: ()=>clean(src) }
}

function clean(src) {
    console.debug("Cleanup image %s", src)
}