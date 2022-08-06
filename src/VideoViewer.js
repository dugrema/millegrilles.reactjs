import React, {useEffect, useState, useMemo, useCallback} from 'react'
// import ReactPlayer from 'react-player/file'

function VideoViewer(props) {
    const {
        src, 
        poster,
        videos,
        className,
        selecteur,
        // Evenements
        onTimeUpdate, onProgress, onPlay, onWaiting,
    } = props

    const width = props.width || '100%',
          height = props.height || '100%',
          codecVideo = props.codecVideo || '',
          mimetype = props.mimetype || ''
      
    let sources = useMemo(()=>{
        if(!videos) return []

        let mimetypeCodec = mimetype
        if(codecVideo) {
            mimetypeCodec = mimetype + `;codecs="${codecVideo}"`
        }
    
        const sources = videos.map(item=>{
            const {src, mimetype, codecVideo} = item
            let mimetypeCodec = mapperCodec(mimetype, codecVideo)
            return <source key={src} src={src} type={mimetypeCodec} />
        })

        if(src) {
            let mimetypeCodec = mapperCodec(mimetype, codecVideo)
            sources.push(<source key="base" src={src} type={mimetypeCodec} />)
        }

        return sources
    }, [src, videos, codecVideo, mimetype])

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
    const [playbackCommence, setPlaybackCommence] = useState(false)

    const playbackCommenceHandler = useCallback(event=>{
        setPlaybackCommence(true)
        if(onPlay) onPlay(event)  // propagation
    }, [onPlay, setPlaybackCommence])

    useEffect(()=>{
        // Override pour playback, la source a change
        setPlaybackCommence(false)
        setActif(false)
    }, [selecteur, setActif, setPlaybackCommence])

    useEffect(()=>{
        if(playbackCommence) return  // Ignorer changements au video si le playback est commence

        // Forcer un toggle d'affichage sur changements sources ou videos
        console.debug("Changement videos : src : %O, videos : %O", src, videos)
        setActif(false)
    }, [src, playbackCommence, videos, sources, setActif])

    useEffect(()=>{
        if(!actif) setActif(true)
    }, [actif, setActif])

    if(!actif) return ''

    return (
        <video width={width} height={height} className={className} poster={poster} controls
            onPlay={playbackCommenceHandler}
            onTimeUpdate={onTimeUpdate}
            onProgress={onProgress}
            onWaiting={onWaiting}>
            {sources}
        </video>
    )
}

export default VideoViewer

function mapperCodec(mimetype, codecVideo) {
    let mimetypeCodec = mimetype
    if(codecVideo === 'hevc') {
        // Nom codec pour iOS
        mimetypeCodec = mimetype + `; codecs="hvc1"`
    } else if(codecVideo === 'h264') {
        // Omettre le codecs, devrait etre supporte partout
        mimetypeCodec = mimetype
    } else if(codecVideo) {
        mimetypeCodec = mimetype + `; codecs="${codecVideo}"`
    } 
    return mimetypeCodec
}