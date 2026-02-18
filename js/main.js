document.addEventListener('DOMContentLoaded', () => {


  const steps   = [...document.querySelectorAll('.step')];
  let   current = 1;
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  function show(n) {
    steps.forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
    prevBtn.style.display = n===1 ? 'none' : '';
    nextBtn.textContent  = n===5 ? 'Generar y Guardar' : 'Siguiente';
  }
  prevBtn.onclick = () => { if (current>1) show(--current); };
  nextBtn.onclick = () => {
    if (current<5) show(++current);
    else generatePoster();
  };
  show(current);

  // — Globals —
  let img = null, pagesX=1, pagesY=1, cropper=null;
  const fileIn   = document.getElementById('imageInput');
  const imgPrev  = document.getElementById('imgPreview');
  const cropBtn  = document.getElementById('cropBtn');
  const sheetSz  = document.getElementById('sheetSize');
  const orient   = document.getElementById('orientation');
  const mT       = document.getElementById('marginTop');
  const mL       = document.getElementById('marginLeft');
  const mR       = document.getElementById('marginRight');
  const mB       = document.getElementById('marginBottom');
  const linkM    = document.getElementById('linkMargins');
  const resetM   = document.getElementById('resetMarginsBtn');
  const oW       = document.getElementById('overlapWidth');
  const oH       = document.getElementById('overlapHeight');
  const posBtns  = document.querySelectorAll('[data-pos]');
  const pXIn     = document.getElementById('pagesX');
  const pYIn     = document.getElementById('pagesY');
  const incBtns  = document.querySelectorAll('.inc');
  const resLab   = document.getElementById('resultLabel');
  const keepAsp  = document.getElementById('keepAspect');
  const alignIn  = document.getElementById('imageAlign');
  const alignLbl = document.getElementById('imageAlignLabel');
  const alignGrp = document.getElementById('alignmentGroup');
  const showG    = document.getElementById('showGuides');
  const showO    = document.getElementById('showOverlap');
  const openChk  = document.getElementById('openPdf');
  const cMargin  = document.getElementById('marginCanvas');
  const cOver    = document.getElementById('overlapCanvas');
  const cPrev    = document.getElementById('previewCanvas');
  const ctxM     = cMargin.getContext('2d');
  const ctxO     = cOver.getContext('2d');
  const ctxP     = cPrev.getContext('2d');

  const sheets = {
    letter: { w:216, h:279 },
    A4:     { w:210, h:297 },
    tabloid:{ w:279, h:432 }
  };


  // – Paso 1:
  fileIn.onchange = () => {
    const f = fileIn.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target.result;
      imgPrev.src = url;
      // init Cropper
      if (cropper) cropper.destroy();
      cropper = new Cropper(imgPrev, {
        viewMode: 1, autoCropArea: 1,
        background: false, movable: true, zoomable: true
      });
      // pre-asigna img para preview
      img = new Image();
      img.onload = () => {
        drawMargin();
        drawOverlap();
        drawPreview();
      };
      img.src = url;
    };
    reader.readAsDataURL(f);
  };


  // – Paso 1b: cut –

  cropBtn.onclick = () => {
    if (!cropper) return;
    const canvasCrop = cropper.getCroppedCanvas();
    const url        = canvasCrop.toDataURL('image/png');
    cropper.destroy();
    cropper = null;
    imgPrev.src = url;
    img = new Image();
    img.onload = () => {
      drawMargin();
      drawOverlap();
      drawPreview();
    };
    img.src = url;
  };


  // – Paso 2

  resetM.onclick = () => {
    mT.value = mL.value = mR.value = mB.value = 0;
    drawMargin();
    drawPreview();
  };

  function syncMarginsFrom(sourceInput){
    if (!linkM.checked) return;
    const v = sourceInput.value;
    [mT, mL, mR, mB].forEach(input => {
      if (input !== sourceInput) input.value = v;
    });
  }


  // – Paso 2: Preview 

  function drawMargin(){
    const {w:sw0,h:sh0} = sheets[sheetSz.value];
    let sw=sw0, sh=sh0;
    if (orient.value==='landscape') [sw,sh]=[sh,sw];
    const sx = cMargin.width/sw, sy = cMargin.height/sh;
    const mt = +mT.value*10, ml = +mL.value*10,
          mr = +mR.value*10, mb = +mB.value*10;
    ctxM.clearRect(0,0,cMargin.width,cMargin.height);
    ctxM.fillStyle='rgba(255,0,0,0.3)';
    ctxM.fillRect(0,0,cMargin.width, mt*sy);
    ctxM.fillRect(0,cMargin.height-mb*sy, cMargin.width, mb*sy);
    ctxM.fillRect(0,0, ml*sx, cMargin.height);
    ctxM.fillRect(cMargin.width-mr*sx,0, mr*sx, cMargin.height);
  }

  // – Paso 3: Preview solapado –

  let overlapPos='top-left';
  posBtns.forEach(b=>{
    b.onclick = () => { overlapPos = b.dataset.pos; drawOverlap(); };
  });
  function drawOverlap(){
    const {w:sw0,h:sh0} = sheets[sheetSz.value];
    let sw=sw0, sh=sh0;
    if (orient.value==='landscape') [sw,sh]=[sh,sw];
    const sx = cOver.width/sw, sy = cOver.height/sh;
    const ow = +oW.value*10, oh = +oH.value*10;
    ctxO.clearRect(0,0,cOver.width,cOver.height);
    ctxO.fillStyle='rgba(255,0,0,0.3)';
    if (overlapPos.includes('top'))
      ctxO.fillRect(0,0,cOver.width, oh*sy);
    if (overlapPos.includes('bottom'))
      ctxO.fillRect(0,cOver.height-oh*sy, cOver.width, oh*sy);
    if (overlapPos.includes('left'))
      ctxO.fillRect(0,0, ow*sx, cOver.height);
    if (overlapPos.includes('right'))
      ctxO.fillRect(cOver.width-ow*sx,0, ow*sx, cOver.height);
  }

  // – Paso 4:

  function updateAlignmentControl(){
    const isPortrait = orient.value === 'portrait';
    alignLbl.textContent = isPortrait ? 'Alineación vertical:' : 'Alineación horizontal:';

    const options = [...alignIn.options];
    options[0].textContent = isPortrait ? 'Arriba' : 'Izquierda';
    options[1].textContent = 'Centro';
    options[2].textContent = isPortrait ? 'Abajo' : 'Derecha';

    alignGrp.style.display = keepAsp.checked ? '' : 'none';
  }

  function getOffset(spare, mode){
    if (spare <= 0) return 0;
    if (mode === 'start') return 0;
    if (mode === 'end') return spare;
    return spare / 2;
  }

  function getImagePlacement(totalWmm, totalHmm){
    if (!keepAsp.checked){
      return { x:0, y:0, w:totalWmm, h:totalHmm };
    }

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const posterRatio = totalWmm / totalHmm;

    if (imgRatio > posterRatio){
      const w = totalWmm;
      const h = w / imgRatio;
      const spareY = totalHmm - h;
      const y = orient.value === 'portrait'
        ? getOffset(spareY, alignIn.value)
        : spareY / 2;
      return { x:0, y, w, h };
    }

    const h = totalHmm;
    const w = h * imgRatio;
    const spareX = totalWmm - w;
    const x = orient.value === 'landscape'
      ? getOffset(spareX, alignIn.value)
      : spareX / 2;
    return { x, y:0, w, h };
  }
  function drawPreview(){
    if (!img) return;
    const {w:sw0,h:sh0} = sheets[sheetSz.value];
    let sw=sw0, sh=sh0;
    if (orient.value==='landscape') [sw,sh]=[sh,sw];
    const overlapW = +oW.value*10,
          overlapH = +oH.value*10;

    
    pagesX = Math.max(1, +pXIn.value);
    pagesY = Math.max(1, +pYIn.value);

    pXIn.value = pagesX;
    pYIn.value = pagesY;
    resLab.textContent = `Páginas: ${pagesX}×${pagesY}`;


    const totalWmm = pagesX*sw - overlapW*(pagesX-1);
    const totalHmm = pagesY*sh - overlapH*(pagesY-1);
    const PREV_W = 400;
    const PREV_H = Math.round(PREV_W * totalHmm / totalWmm);
    cPrev.width  = PREV_W;
    cPrev.height = PREV_H;


    const tileW = PREV_W/pagesX,
          tileH = PREV_H/pagesY;

    const placement = getImagePlacement(totalWmm, totalHmm);
    const scaleX = PREV_W / totalWmm;
    const scaleY = PREV_H / totalHmm;

    ctxP.clearRect(0,0,PREV_W,PREV_H);
    ctxP.fillStyle = '#fff';
    ctxP.fillRect(0,0,PREV_W,PREV_H);
    ctxP.drawImage(
      img,
      placement.x * scaleX,
      placement.y * scaleY,
      placement.w * scaleX,
      placement.h * scaleY
    );


    // 5) Cuadrícula
    ctxP.save();
    ctxP.strokeStyle='#007bff';
    ctxP.setLineDash([4,2]);
    for(let i=1;i<pagesX;i++){
      const X=i*tileW;
      ctxP.beginPath(); ctxP.moveTo(X,0); ctxP.lineTo(X,PREV_H); ctxP.stroke();
    }
    for(let j=1;j<pagesY;j++){
      const Y=j*tileH;
      ctxP.beginPath(); ctxP.moveTo(0,Y); ctxP.lineTo(PREV_W,Y); ctxP.stroke();
    }
    ctxP.restore();

    // 6) Solapado
    if (showO.checked){
      const owPx = overlapW/sw*tileW,
            ohPx = overlapH/sh*tileH;
      ctxP.save();
      ctxP.fillStyle='rgba(255,0,0,0.3)';
      for(let i=1;i<pagesX;i++){
        const X=i*tileW - owPx/2;
        ctxP.fillRect(X,0,owPx,PREV_H);
      }
      for(let j=1;j<pagesY;j++){
        const Y=j*tileH - ohPx/2;
        ctxP.fillRect(0,Y,PREV_W,ohPx);
      }
      ctxP.restore();
    }
  }



  incBtns.forEach(b=>{
    b.onclick = ()=>{
      const t = document.getElementById(b.dataset.target);
      let   v = +t.value;
      v = b.dataset.op==='+'? v+1 : Math.max(1,v-1);
      t.value = v;
      drawPreview();
    };
  });




  [
    sheetSz, orient,
    mT,mL,mR,mB,
    oW,oH,
    pXIn,pYIn,
    keepAsp, alignIn,
    showG,showO
  ].forEach(el=> el.addEventListener('input', e=>{
    if (e.target === orient || e.target === keepAsp) {
      updateAlignmentControl();
    }
    if ([mT,mL,mR,mB].includes(e.target)) {
      syncMarginsFrom(e.target);
    }
    drawMargin();
    drawOverlap();
    drawPreview();
  }));

  linkM.addEventListener('change', () => {
    if (linkM.checked) syncMarginsFrom(mT);
    drawMargin();
    drawPreview();
  });

  updateAlignmentControl();



  // — Paso 5: PDF —

  function createPosterRaster(totalWmm, totalHmm, placement){
    const posterPxWidth = Math.max(1, Math.ceil(totalWmm * 12));
    const posterPxHeight = Math.max(1, Math.ceil(totalHmm * 12));
    const canvas = document.createElement('canvas');
    canvas.width = posterPxWidth;
    canvas.height = posterPxHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, posterPxWidth, posterPxHeight);

    ctx.drawImage(
      img,
      placement.x / totalWmm * posterPxWidth,
      placement.y / totalHmm * posterPxHeight,
      placement.w / totalWmm * posterPxWidth,
      placement.h / totalHmm * posterPxHeight
    );

    return canvas;
  }

  async function generatePoster(){
    if (!img) return alert('Primero carga y recorta una imagen');
    drawPreview();
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        unit:'mm',
        format:[ sheets[sheetSz.value].w, sheets[sheetSz.value].h ],
        orientation: orient.value
      });
      const { w:baseW, h:baseH } = sheets[sheetSz.value];
      const sheetW = orient.value === 'landscape' ? baseH : baseW;
      const sheetH = orient.value === 'landscape' ? baseW : baseH;
      const overlapW = +oW.value * 10;
      const overlapH = +oH.value * 10;
      const totalWmm = pagesX * sheetW - overlapW * (pagesX - 1);
      const totalHmm = pagesY * sheetH - overlapH * (pagesY - 1);
      const placement = getImagePlacement(totalWmm, totalHmm);
      const posterCanvas = createPosterRaster(totalWmm, totalHmm, placement);
      const mmToPxX = posterCanvas.width / totalWmm;
      const mmToPxY = posterCanvas.height / totalHmm;

      let idx=0;
      for(let y=0;y<pagesY;y++){
        for(let x=0;x<pagesX;x++){
          if (idx++) pdf.addPage();
          const sx = x * (sheetW - overlapW);
          const sy = y * (sheetH - overlapH);

          const srcX = Math.round(sx * mmToPxX);
          const srcY = Math.round(sy * mmToPxY);
          const srcW = Math.round(sheetW * mmToPxX);
          const srcH = Math.round(sheetH * mmToPxY);

          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = srcW;
          tileCanvas.height = srcH;
          const tileCtx = tileCanvas.getContext('2d');
          tileCtx.fillStyle = '#fff';
          tileCtx.fillRect(0, 0, srcW, srcH);
          tileCtx.drawImage(
            posterCanvas,
            srcX,
            srcY,
            srcW,
            srcH,
            0,
            0,
            srcW,
            srcH
          );

          pdf.addImage(
            tileCanvas,
            'PNG',
            0,
            0,
            sheetW,
            sheetH
          );

          if (showG.checked){
            pdf.setLineDash([3,3],0);
            pdf.setDrawColor(255,0,0);
            pdf.rect(0,0,sheetW,sheetH);
          }

          if (showO.checked){
            pdf.setFillColor(255,220,220);
            if (x > 0) pdf.rect(0, 0, overlapW, sheetH, 'F');
            if (x < pagesX - 1) pdf.rect(sheetW - overlapW, 0, overlapW, sheetH, 'F');
            if (y > 0) pdf.rect(0, 0, sheetW, overlapH, 'F');
            if (y < pagesY - 1) pdf.rect(0, sheetH - overlapH, sheetW, overlapH, 'F');
          }
        }
      }
      pdf.save('poster.pdf');
      if (openChk.checked) window.open(pdf.output('bloburl'));
    } catch(err){
      alert('Error generando PDF: '+err.message);
    }
  }
});
