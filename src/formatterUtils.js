import React from 'react'
import moment from 'moment-timezone'
import momentDurationFormatSetup from "moment-duration-format"
momentDurationFormatSetup(moment)  // Activer plugin

const CONST_DATE_DEFAULT = 'YYYY/MM/DD',
      CONST_DATETIME_DEFAULT = 'YYYY/MM/DD HH:mm:ss',
      CONST_DATEMONTHHOUR_DEFAULT = 'MMM-DD HH:mm:ss',
      CONST_TIMEZONE_DEFAULT  = 'America/Toronto'

export function formatterDateString(opts) {
    opts = opts || {}
    const date = opts.date || new Date()
    const format = opts.format || CONST_DATETIME_DEFAULT
    const timezone = opts.timezone || CONST_TIMEZONE_DEFAULT
    
    return moment(date).tz(timezone).format(format)
}
