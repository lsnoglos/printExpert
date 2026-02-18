document.addEventListener('DOMContentLoaded', () => {
  const TOTAL_STEPS = 4;
  const steps = [...document.querySelectorAll('.step')];
  let current = 1;
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  function show(n) {
    steps.forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
    prevBtn.style.display = n === 1 ? 'none' : '';
    nextBtn.textContent = n === TOTAL_STEPS ? 'Generar y Guardar' : 'Siguiente';
  }

  prevBtn.onclick = () => { if (current > 1) show(--current); };
  nextBtn.onclick = () => {
    if (current < TOTAL_STEPS) show(++current);
    else generatePoster();
  };
  show(current);

  let img = null;
  let pagesX = 1;
  let pagesY = 1;
  let cropper = null;

  const fileIn = document.getElementById('imageInput');
  const imgPrev = document.getElementById('imgPreview');
  const cropBtn = document.getElementById('cropBtn');
  const sheetSz = document.getElementById('sheetSize');
  const orient = document.getElementById('orientation');
  const mT = document.getElementById('marginTop');
  const mL = document.getElementById('marginLeft');
  const mR = document.getElementById('marginRight');
  const mB = document.getElementById('marginBottom');
  const linkM = document.getElementById('linkMargins');
  const resetM = document.getElementById('resetMarginsBtn');
  const oW = document.getElementById('overlapWidth');
  const oH = document.getElementById('overlapHeight');
  const blankOverlap = document.getElementById('blankOverlap');
  const pXIn = document.getElementById('pagesX');
  const pYIn = document.getElementById('pagesY');
  const incBtns = document.querySelectorAll('.inc');
  const resLab = document.getElementById('resultLabel');
  const keepAsp = document.getElementById('keepAspect');
  const alignIn = document.getElementById('imageAlign');
  const alignLbl = document.getElementById('imageAlignLabel');
  const alignGrp = document.getElementById('alignmentGroup');
  const showG = document.getElementById('showGuides');
  const showO = document.getElementById('showOverlap');
  const openChk = document.getElementById('openPdf');
  const cPrev = document.getElementById('previewCanvas');
  const ctxP = cPrev.getContext('2d');

  const sheets = {
    letter: { w: 216, h: 279 },
    A4: { w: 210, h: 297 },
    tabloid: { w: 279, h: 432 }
  };

  function getSheetSizeMm() {
    const { w: sw0, h: sh0 } = sheets[sheetSz.value];
    return orient.value === 'landscape' ? { sheetW: sh0, sheetH: sw0 } : { sheetW: sw0, sheetH: sh0 };
  }

  function getPosterGeometry() {
    const { sheetW, sheetH } = getSheetSizeMm();
    const overlapW = Math.max(0, +oW.value * 10);
    const overlapH = Math.max(0, +oH.value * 10);
    const blank = blankOverlap.checked;

    const totalWmm = blank ? pagesX * sheetW : pagesX * sheetW - overlapW * (pagesX - 1);
    const totalHmm = blank ? pagesY * sheetH : pagesY * sheetH - overlapH * (pagesY - 1);

    return { sheetW, sheetH, overlapW, overlapH, blank, totalWmm, totalHmm };
  }

  function syncMarginsFrom(sourceInput) {
    if (!linkM.checked) return;
    const v = sourceInput.value;
    [mT, mL, mR, mB].forEach(input => {
      if (input !== sourceInput) input.value = v;
    });
  }

  function updateAlignmentControl() {
    alignLbl.textContent = 'Alineación de imagen:';
    alignGrp.style.display = keepAsp.checked ? '' : 'none';
  }

  function getOffset(spare, mode) {
    if (spare <= 0) return 0;
    if (mode === 'start') return 0;
    if (mode === 'end') return spare;
    return spare / 2;
  }

  function getAlignmentModes() {
    switch (alignIn.value) {
      case 'top':
        return { horizontal: 'center', vertical: 'start' };
      case 'bottom':
        return { horizontal: 'center', vertical: 'end' };
      case 'left':
        return { horizontal: 'start', vertical: 'center' };
      case 'right':
        return { horizontal: 'end', vertical: 'center' };
      default:
        return { horizontal: 'center', vertical: 'center' };
    }
  }

  function getImagePlacement(totalWmm, totalHmm) {
    if (!keepAsp.checked) {
      return { x: 0, y: 0, w: totalWmm, h: totalHmm };
    }

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const posterRatio = totalWmm / totalHmm;
    const align = getAlignmentModes();

    if (imgRatio > posterRatio) {
      const w = totalWmm;
      const h = w / imgRatio;
      const spareY = totalHmm - h;
      const y = getOffset(spareY, align.vertical);
      return { x: 0, y, w, h };
    }

    const h = totalHmm;
    const w = h * imgRatio;
    const spareX = totalWmm - w;
    const x = getOffset(spareX, align.horizontal);
    return { x, y: 0, w, h };
  }

  function drawPreview() {
    if (!img) return;

    pagesX = Math.max(1, +pXIn.value || 1);
    pagesY = Math.max(1, +pYIn.value || 1);
    pXIn.value = pagesX;
    pYIn.value = pagesY;
    resLab.textContent = `Páginas: ${pagesX}×${pagesY}`;

    const { sheetW, sheetH, overlapW, overlapH, blank, totalWmm, totalHmm } = getPosterGeometry();

    const PREV_W = 460;
    const PREV_H = Math.max(120, Math.round(PREV_W * totalHmm / totalWmm));
    cPrev.width = PREV_W;
    cPrev.height = PREV_H;

    const scaleX = PREV_W / totalWmm;
    const scaleY = PREV_H / totalHmm;
    const tileW = sheetW * scaleX;
    const tileH = sheetH * scaleY;
    const stepX = blank ? tileW : (sheetW - overlapW) * scaleX;
    const stepY = blank ? tileH : (sheetH - overlapH) * scaleY;

    const mt = Math.max(0, +mT.value * 10);
    const ml = Math.max(0, +mL.value * 10);
    const mr = Math.max(0, +mR.value * 10);
    const mb = Math.max(0, +mB.value * 10);

    const placement = getImagePlacement(totalWmm, totalHmm);

    ctxP.clearRect(0, 0, PREV_W, PREV_H);
    ctxP.fillStyle = '#fff';
    ctxP.fillRect(0, 0, PREV_W, PREV_H);

    ctxP.drawImage(
      img,
      placement.x * scaleX,
      placement.y * scaleY,
      placement.w * scaleX,
      placement.h * scaleY
    );

    if (showO.checked) {
      ctxP.save();
      ctxP.fillStyle = 'rgba(0, 128, 0, 0.15)';
      if (!blank) {
        for (let i = 1; i < pagesX; i++) {
          const x = i * stepX;
          const owPx = overlapW * scaleX;
          ctxP.fillRect(x - owPx / 2, 0, owPx, PREV_H);
        }
        for (let j = 1; j < pagesY; j++) {
          const y = j * stepY;
          const ohPx = overlapH * scaleY;
          ctxP.fillRect(0, y - ohPx / 2, PREV_W, ohPx);
        }
      } else {
        for (let i = 0; i < pagesX - 1; i++) {
          const x = (i + 1) * stepX - overlapW * scaleX;
          ctxP.fillRect(x, 0, overlapW * scaleX, PREV_H);
        }
        for (let j = 0; j < pagesY - 1; j++) {
          const y = (j + 1) * stepY - overlapH * scaleY;
          ctxP.fillRect(0, y, PREV_W, overlapH * scaleY);
        }
      }
      ctxP.restore();
    }

    if (showG.checked) {
      ctxP.save();
      ctxP.setLineDash([5, 3]);

      for (let y = 0; y < pagesY; y++) {
        for (let x = 0; x < pagesX; x++) {
          const tileX = x * stepX;
          const tileY = y * stepY;

          const mLeftPx = Math.min(ml * scaleX, tileW / 2);
          const mRightPx = Math.min(mr * scaleX, tileW / 2);
          const mTopPx = Math.min(mt * scaleY, tileH / 2);
          const mBottomPx = Math.min(mb * scaleY, tileH / 2);

          ctxP.strokeStyle = '#cf1b1b';
          ctxP.strokeRect(
            tileX + mLeftPx,
            tileY + mTopPx,
            Math.max(1, tileW - mLeftPx - mRightPx),
            Math.max(1, tileH - mTopPx - mBottomPx)
          );

          ctxP.strokeStyle = '#0f9d58';
          if (!blank) {
            if (x > 0 && overlapW > 0) {
              ctxP.beginPath();
              ctxP.moveTo(tileX, tileY);
              ctxP.lineTo(tileX, tileY + tileH);
              ctxP.stroke();
            }
            if (y > 0 && overlapH > 0) {
              ctxP.beginPath();
              ctxP.moveTo(tileX, tileY);
              ctxP.lineTo(tileX + tileW, tileY);
              ctxP.stroke();
            }
          } else {
            if (x < pagesX - 1 && overlapW > 0) {
              const gx = tileX + tileW - overlapW * scaleX;
              ctxP.beginPath();
              ctxP.moveTo(gx, tileY);
              ctxP.lineTo(gx, tileY + tileH);
              ctxP.stroke();
            }
            if (y < pagesY - 1 && overlapH > 0) {
              const gy = tileY + tileH - overlapH * scaleY;
              ctxP.beginPath();
              ctxP.moveTo(tileX, gy);
              ctxP.lineTo(tileX + tileW, gy);
              ctxP.stroke();
            }
          }
        }
      }

      ctxP.restore();
    }
  }

  function createPosterRaster(totalWmm, totalHmm, placement) {
    const posterPxWidth = Math.max(1, Math.ceil(totalWmm * 14));
    const posterPxHeight = Math.max(1, Math.ceil(totalHmm * 14));
    const canvas = document.createElement('canvas');
    canvas.width = posterPxWidth;
    canvas.height = posterPxHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, posterPxWidth, posterPxHeight);

    ctx.drawImage(
      img,
      (placement.x / totalWmm) * posterPxWidth,
      (placement.y / totalHmm) * posterPxHeight,
      (placement.w / totalWmm) * posterPxWidth,
      (placement.h / totalHmm) * posterPxHeight
    );

    return canvas;
  }

  async function generatePoster() {
    if (!img) return alert('Primero carga y recorta una imagen');
    drawPreview();

    try {
      const { jsPDF } = window.jspdf;
      const { sheetW, sheetH, overlapW, overlapH, blank, totalWmm, totalHmm } = getPosterGeometry();
      const mt = Math.max(0, +mT.value * 10);
      const ml = Math.max(0, +mL.value * 10);
      const mr = Math.max(0, +mR.value * 10);
      const mb = Math.max(0, +mB.value * 10);

      const pdf = new jsPDF({
        unit: 'mm',
        format: [sheets[sheetSz.value].w, sheets[sheetSz.value].h],
        orientation: orient.value
      });

      const placement = getImagePlacement(totalWmm, totalHmm);
      const posterCanvas = createPosterRaster(totalWmm, totalHmm, placement);
      const mmToPxX = posterCanvas.width / totalWmm;
      const mmToPxY = posterCanvas.height / totalHmm;

      let idx = 0;
      for (let y = 0; y < pagesY; y++) {
        for (let x = 0; x < pagesX; x++) {
          if (idx++) pdf.addPage();

          const sx = blank ? x * sheetW : x * (sheetW - overlapW);
          const sy = blank ? y * sheetH : y * (sheetH - overlapH);

          const srcX0 = Math.floor(sx * mmToPxX);
          const srcY0 = Math.floor(sy * mmToPxY);
          const srcX1 = Math.ceil((sx + sheetW) * mmToPxX);
          const srcY1 = Math.ceil((sy + sheetH) * mmToPxY);
          const srcW = Math.max(1, srcX1 - srcX0);
          const srcH = Math.max(1, srcY1 - srcY0);

          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = srcW;
          tileCanvas.height = srcH;
          const tileCtx = tileCanvas.getContext('2d');
          tileCtx.fillStyle = '#fff';
          tileCtx.fillRect(0, 0, srcW, srcH);
          tileCtx.drawImage(posterCanvas, srcX0, srcY0, srcW, srcH, 0, 0, srcW, srcH);

          if (blank && showO.checked) {
            tileCtx.fillStyle = '#fff';
            if (x < pagesX - 1 && overlapW > 0) {
              tileCtx.fillRect((srcW * (sheetW - overlapW)) / sheetW, 0, (srcW * overlapW) / sheetW, srcH);
            }
            if (y < pagesY - 1 && overlapH > 0) {
              tileCtx.fillRect(0, (srcH * (sheetH - overlapH)) / sheetH, srcW, (srcH * overlapH) / sheetH);
            }
          }

          pdf.addImage(tileCanvas.toDataURL('image/png'), 'PNG', 0, 0, sheetW, sheetH, undefined, 'FAST');

          if (showO.checked) {
            pdf.setFillColor(210, 245, 220);
            if (!blank) {
              if (x > 0) pdf.rect(0, 0, overlapW, sheetH, 'F');
              if (x < pagesX - 1) pdf.rect(sheetW - overlapW, 0, overlapW, sheetH, 'F');
              if (y > 0) pdf.rect(0, 0, sheetW, overlapH, 'F');
              if (y < pagesY - 1) pdf.rect(0, sheetH - overlapH, sheetW, overlapH, 'F');
            } else {
              if (x < pagesX - 1) pdf.rect(sheetW - overlapW, 0, overlapW, sheetH, 'F');
              if (y < pagesY - 1) pdf.rect(0, sheetH - overlapH, sheetW, overlapH, 'F');
            }
          }

          if (showG.checked) {
            pdf.setLineDash([3, 3], 0);
            pdf.setDrawColor(207, 27, 27);
            pdf.rect(
              Math.min(ml, sheetW / 2),
              Math.min(mt, sheetH / 2),
              Math.max(1, sheetW - Math.min(ml, sheetW / 2) - Math.min(mr, sheetW / 2)),
              Math.max(1, sheetH - Math.min(mt, sheetH / 2) - Math.min(mb, sheetH / 2))
            );

            pdf.setDrawColor(15, 157, 88);
            if (!blank) {
              if (x > 0 && overlapW > 0) pdf.line(0, 0, 0, sheetH);
              if (y > 0 && overlapH > 0) pdf.line(0, 0, sheetW, 0);
            } else {
              if (x < pagesX - 1 && overlapW > 0) pdf.line(sheetW - overlapW, 0, sheetW - overlapW, sheetH);
              if (y < pagesY - 1 && overlapH > 0) pdf.line(0, sheetH - overlapH, sheetW, sheetH - overlapH);
            }
          }
        }
      }

      pdf.save('poster.pdf');
      if (openChk.checked) window.open(pdf.output('bloburl'));
    } catch (err) {
      alert('Error generando PDF: ' + err.message);
    }
  }

  fileIn.onchange = () => {
    const f = fileIn.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target.result;
      imgPrev.src = url;
      if (cropper) cropper.destroy();
      cropper = new Cropper(imgPrev, {
        viewMode: 1,
        autoCropArea: 1,
        background: false,
        movable: true,
        zoomable: true
      });
      img = new Image();
      img.onload = drawPreview;
      img.src = url;
    };
    reader.readAsDataURL(f);
  };

  cropBtn.onclick = () => {
    if (!cropper) return;
    const canvasCrop = cropper.getCroppedCanvas();
    const url = canvasCrop.toDataURL('image/png');
    cropper.destroy();
    cropper = null;
    imgPrev.src = url;
    img = new Image();
    img.onload = drawPreview;
    img.src = url;
  };

  resetM.onclick = () => {
    mT.value = mL.value = mR.value = mB.value = 0;
    drawPreview();
  };

  incBtns.forEach(b => {
    b.onclick = () => {
      const t = document.getElementById(b.dataset.target);
      let v = +t.value;
      v = b.dataset.op === '+' ? v + 1 : Math.max(1, v - 1);
      t.value = v;
      drawPreview();
    };
  });

  const previewInputs = [
    sheetSz,
    orient,
    mT, mL, mR, mB,
    oW, oH,
    blankOverlap,
    pXIn, pYIn,
    keepAsp, alignIn,
    showG, showO
  ];

  function handlePreviewControlChange(e) {
    if (e.target === orient || e.target === keepAsp) {
      updateAlignmentControl();
    }
    if ([mT, mL, mR, mB].includes(e.target)) {
      syncMarginsFrom(e.target);
    }
    drawPreview();
  }

  previewInputs.forEach(el => {
    el.addEventListener('input', handlePreviewControlChange);
    el.addEventListener('change', handlePreviewControlChange);
  });

  linkM.addEventListener('change', () => {
    if (linkM.checked) syncMarginsFrom(mT);
    drawPreview();
  });

  updateAlignmentControl();
});
