const r=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#14b8a6"],g=(e="?",t=100)=>{const o=r,n=e.charCodeAt(0)%o.length,s=o[n],c=`
    <svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}">
      <rect width="${t}" height="${t}" fill="${s}"/>
      <text x="50%" y="50%" font-size="${t*.4}" font-weight="bold" fill="white"
            text-anchor="middle" dy=".3em" font-family="system-ui, -apple-system, sans-serif">
        ${e.substring(0,2).toUpperCase()}
      </text>
    </svg>
  `.trim();return`data:image/svg+xml,${encodeURIComponent(c)}`};export{g};
