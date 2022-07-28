import React, {useEffect, useState} from 'react'
import ReactPlayer from 'react-player/file'

function VideoViewer(props) {
    const {
        src, 
        poster,
        videos,
        className,
    } = props

    const width = props.width || '100%',
          height = props.height || '100%',
          codecVideo = props.codecVideo || '',
          mimetype = props.mimetype || ''

    let sources = []
    if(videos) {
        sources = videos.map(item=>{
            const {src, mimetype, codecVideo} = item
            let mimetypeCodec = mimetype
            if(codecVideo === 'h264') {
                // Omettre le codecs, devrait etre supporte partout
                mimetypeCodec = mimetype
            } else if(codecVideo) {
                mimetypeCodec = mimetype + `;codecs="${codecVideo}"`
            } 
            return <source key={src} src={src} type={mimetypeCodec} />
        })
    }
    if(src) {
        let mimetypeCodec = mimetype
        if(codecVideo) {
            mimetypeCodec = mimetype + `;codecs="${codecVideo}"`
        }
        sources.push(<source key="base" src={src} type={mimetypeCodec} />)
    }

    let mimetypeCodec = mimetype
    if(codecVideo) {
        mimetypeCodec = mimetype + `;codecs="${codecVideo}"`
    }

    // return (
    //     <ReactPlayer 
    //         className={className}
    //         url={src} 
    //         width={width} 
    //         height={height} 
    //         controls={true} 
    //         />
    // )

    const [actif, setActif] = useState(true)

    useEffect(()=>{
        // Forcer un toggle d'affichage
        console.debug("Changement videos : src : %O, videos : %O", src, videos)
        setActif(false)
    }, [src, videos, setActif])

    useEffect(()=>{
        if(!actif) setActif(true)
    }, [actif, setActif])

    if(!actif) return ''

    return (
        <video width={width} height={height} className={className} poster={poster} controls>
            {sources}
        </video>
    )
}

export default VideoViewer
