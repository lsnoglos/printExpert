document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'printExpertState';
  const TOTAL_STEPS = 4;
  const steps = [...document.querySelectorAll('.step')];
  let current = 1;
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const newBtn = document.getElementById('newBtn');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const wizardForm = document.getElementById('wizardForm');

  function show(n) {
    steps.forEach(s => s.classList.remove('active'));
    document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
    prevBtn.style.display = n === 1 ? 'none' : '';
    nextBtn.textContent = n === TOTAL_STEPS ? 'Generar y Guardar' : 'Siguiente';
  }

  prevBtn.onclick = () => {
    if (current > 1) {
      show(--current);
      saveState();
    }
  };
  nextBtn.onclick = () => {
    if (current < TOTAL_STEPS) {
      show(++current);
      saveState();
    } else {
      generatePoster();
    }
  };

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
  const styledG = document.getElementById('styledGuides');
  const showO = document.getElementById('showOverlap');
  const openChk = document.getElementById('openPdf');
  const cPrev = document.getElementById('previewCanvas');
  const ctxP = cPrev.getContext('2d');

  function setLoading(isLoading) {
    loadingOverlay.classList.toggle('visible', isLoading);
    loadingOverlay.setAttribute('aria-hidden', String(!isLoading));
    wizardForm.classList.toggle('is-loading', isLoading);

    const controls = wizardForm.querySelectorAll('button, input, select, textarea');
    controls.forEach(control => {
      control.disabled = isLoading;
    });
  }

  function waitForPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  const sheets = {
    letter: { w: 216, h: 279 },
    A4: { w: 210, h: 297 },
    tabloid: { w: 279, h: 432 }
  };

  function getDefaultState() {
    return {
      current: 1,
      imageData: '',
      sheetSize: 'letter',
      orientation: 'portrait',
      marginTop: '0',
      marginLeft: '0',
      marginRight: '0',
      marginBottom: '0',
      linkMargins: false,
      overlapWidth: '1',
      overlapHeight: '1',
      blankOverlap: false,
      pagesX: '1',
      pagesY: '1',
      keepAspect: true,
      imageAlign: 'center',
      showGuides: true,
      styledGuides: true,
      showOverlap: true,
      openPdf: false
    };
  }

  function getState() {
    return {
      current,
      imageData: img ? img.src : '',
      sheetSize: sheetSz.value,
      orientation: orient.value,
      marginTop: mT.value,
      marginLeft: mL.value,
      marginRight: mR.value,
      marginBottom: mB.value,
      linkMargins: linkM.checked,
      overlapWidth: oW.value,
      overlapHeight: oH.value,
      blankOverlap: blankOverlap.checked,
      pagesX: pXIn.value,
      pagesY: pYIn.value,
      keepAspect: keepAsp.checked,
      imageAlign: alignIn.value,
      showGuides: showG.checked,
      styledGuides: styledG.checked,
      showOverlap: showO.checked,
      openPdf: openChk.checked
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
  }

  function clearSavedState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function getSheetSizeMm() {
    const { w: sw0, h: sh0 } = sheets[sheetSz.value];
    return orient.value === 'landscape' ? { sheetW: sh0, sheetH: sw0 } : { sheetW: sw0, sheetH: sh0 };
  }

  function getPosterGeometry() {
    const { sheetW, sheetH } = getSheetSizeMm();
    const overlapW = Math.max(0, +oW.value * 10);
    const overlapH = Math.max(0, +oH.value * 10);
    const blank = blankOverlap.checked;

    const totalWmm = pagesX * sheetW - overlapW * (pagesX - 1);
    const totalHmm = pagesY * sheetH - overlapH * (pagesY - 1);

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
    resLab.textContent = `Ancho: ${pagesX} · Alto: ${pagesY}`;

    const { sheetW, sheetH, overlapW, overlapH, blank, totalWmm, totalHmm } = getPosterGeometry();

    const PREV_W = 460;
    const PREV_H = Math.max(120, Math.round((PREV_W * totalHmm) / totalWmm));
    cPrev.width = PREV_W;
    cPrev.height = PREV_H;

    const scaleX = PREV_W / totalWmm;
    const scaleY = PREV_H / totalHmm;
    const tileW = sheetW * scaleX;
    const tileH = sheetH * scaleY;
    const stepX = (sheetW - overlapW) * scaleX;
    const stepY = (sheetH - overlapH) * scaleY;

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
        for (let i = 1; i < pagesX; i++) {
          const x = i * stepX;
          ctxP.fillRect(x, 0, overlapW * scaleX, PREV_H);
        }
        for (let j = 1; j < pagesY; j++) {
          const y = j * stepY;
          ctxP.fillRect(0, y, PREV_W, overlapH * scaleY);
        }
      }
      ctxP.restore();
    }

    if (showG.checked) {
      ctxP.save();
      if (styledG.checked) {
        ctxP.setLineDash([5, 3]);
      } else {
        ctxP.setLineDash([]);
      }

      for (let y = 0; y < pagesY; y++) {
        for (let x = 0; x < pagesX; x++) {
          const tileX = x * stepX;
          const tileY = y * stepY;

          const mLeftPx = Math.min(ml * scaleX, tileW / 2);
          const mRightPx = Math.min(mr * scaleX, tileW / 2);
          const mTopPx = Math.min(mt * scaleY, tileH / 2);
          const mBottomPx = Math.min(mb * scaleY, tileH / 2);

          ctxP.strokeStyle = styledG.checked ? '#cf1b1b' : '#2b2b2b';
          ctxP.strokeRect(
            tileX + mLeftPx,
            tileY + mTopPx,
            Math.max(1, tileW - mLeftPx - mRightPx),
            Math.max(1, tileH - mTopPx - mBottomPx)
          );

          ctxP.strokeStyle = styledG.checked ? '#0f9d58' : '#2b2b2b';
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
            if (x > 0 && overlapW > 0) {
              const gx = tileX + overlapW * scaleX;
              ctxP.beginPath();
              ctxP.moveTo(gx, tileY);
              ctxP.lineTo(gx, tileY + tileH);
              ctxP.stroke();
            }
            if (y > 0 && overlapH > 0) {
              const gy = tileY + overlapH * scaleY;
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

  function toPixelBounds(startMm, sizeMm, mmToPx, maxPx) {
    const start = Math.max(0, Math.min(maxPx, Math.round(startMm * mmToPx)));
    const end = Math.max(start, Math.min(maxPx, Math.round((startMm + sizeMm) * mmToPx)));
    return { start, size: Math.max(1, end - start) };
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
    setLoading(true);
    await waitForPaint();

    drawPreview();
    await waitForPaint();

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
          if (idx > 0 && idx % 3 === 0) {
            await waitForPaint();
          }

          if (idx++) pdf.addPage();

          const sx = x * (sheetW - overlapW);
          const sy = y * (sheetH - overlapH);
          const blankLeftMm = blank && x > 0 ? overlapW : 0;
          const blankTopMm = blank && y > 0 ? overlapH : 0;
          const contentWmm = sheetW - blankLeftMm;
          const contentHmm = sheetH - blankTopMm;

          const srcBoundsX = toPixelBounds(sx + blankLeftMm, contentWmm, mmToPxX, posterCanvas.width);
          const srcBoundsY = toPixelBounds(sy + blankTopMm, contentHmm, mmToPxY, posterCanvas.height);

          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = Math.max(1, Math.ceil(sheetW * mmToPxX));
          tileCanvas.height = Math.max(1, Math.ceil(sheetH * mmToPxY));
          const tileCtx = tileCanvas.getContext('2d');
          tileCtx.fillStyle = '#fff';
          tileCtx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);

          const dstBoundsX = toPixelBounds(blankLeftMm, contentWmm, mmToPxX, tileCanvas.width);
          const dstBoundsY = toPixelBounds(blankTopMm, contentHmm, mmToPxY, tileCanvas.height);
          tileCtx.drawImage(
            posterCanvas,
            srcBoundsX.start,
            srcBoundsY.start,
            srcBoundsX.size,
            srcBoundsY.size,
            dstBoundsX.start,
            dstBoundsY.start,
            dstBoundsX.size,
            dstBoundsY.size
          );

          pdf.addImage(tileCanvas.toDataURL('image/png'), 'PNG', 0, 0, sheetW, sheetH, undefined, 'FAST');

          if (showO.checked) {
            pdf.setLineDash(styledG.checked ? [2, 2] : [], 0);
            if (styledG.checked) {
              pdf.setDrawColor(15, 157, 88);
            } else {
              pdf.setDrawColor(60, 60, 60);
            }
            if (!blank) {
              if (x > 0 && overlapW > 0) pdf.line(overlapW, 0, overlapW, sheetH);
              if (x < pagesX - 1 && overlapW > 0) pdf.line(sheetW - overlapW, 0, sheetW - overlapW, sheetH);
              if (y > 0 && overlapH > 0) pdf.line(0, overlapH, sheetW, overlapH);
              if (y < pagesY - 1 && overlapH > 0) pdf.line(0, sheetH - overlapH, sheetW, sheetH - overlapH);
            } else {
              if (x > 0 && overlapW > 0) pdf.line(overlapW, 0, overlapW, sheetH);
              if (y > 0 && overlapH > 0) pdf.line(0, overlapH, sheetW, overlapH);
            }
          }

          if (showG.checked) {
            pdf.setLineDash(styledG.checked ? [3, 3] : [], 0);
            if (styledG.checked) {
              pdf.setDrawColor(207, 27, 27);
            } else {
              pdf.setDrawColor(43, 43, 43);
            }
            pdf.rect(
              Math.min(ml, sheetW / 2),
              Math.min(mt, sheetH / 2),
              Math.max(1, sheetW - Math.min(ml, sheetW / 2) - Math.min(mr, sheetW / 2)),
              Math.max(1, sheetH - Math.min(mt, sheetH / 2) - Math.min(mb, sheetH / 2))
            );
            if (styledG.checked) {
              pdf.setDrawColor(15, 157, 88);
            } else {
              pdf.setDrawColor(43, 43, 43);
            }
            if (!blank) {
              if (x > 0 && overlapW > 0) pdf.line(0, 0, 0, sheetH);
              if (y > 0 && overlapH > 0) pdf.line(0, 0, sheetW, 0);
            } else {
              if (x > 0 && overlapW > 0) pdf.line(overlapW, 0, overlapW, sheetH);
              if (y > 0 && overlapH > 0) pdf.line(0, overlapH, sheetW, overlapH);
            }
          }
        }
      }

      pdf.save('poster.pdf');
      if (openChk.checked) window.open(pdf.output('bloburl'));
    } catch (err) {
      alert('Error generando PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetFormToDefaults() {
    const state = getDefaultState();
    current = state.current;
    sheetSz.value = state.sheetSize;
    orient.value = state.orientation;
    mT.value = state.marginTop;
    mL.value = state.marginLeft;
    mR.value = state.marginRight;
    mB.value = state.marginBottom;
    linkM.checked = state.linkMargins;
    oW.value = state.overlapWidth;
    oH.value = state.overlapHeight;
    blankOverlap.checked = state.blankOverlap;
    pXIn.value = state.pagesX;
    pYIn.value = state.pagesY;
    keepAsp.checked = state.keepAspect;
    alignIn.value = state.imageAlign;
    showG.checked = state.showGuides;
    styledG.checked = state.styledGuides;
    showO.checked = state.showOverlap;
    openChk.checked = state.openPdf;
    fileIn.value = '';
    imgPrev.removeAttribute('src');
    img = null;
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    cPrev.height = 0;
    resLab.textContent = '—';
    updateAlignmentControl();
    show(current);
  }

  function hydrateState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      blankOverlap.checked = false;
      return;
    }

    try {
      const state = { ...getDefaultState(), ...JSON.parse(raw) };
      current = Math.min(TOTAL_STEPS, Math.max(1, +state.current || 1));
      sheetSz.value = state.sheetSize;
      orient.value = state.orientation;
      mT.value = state.marginTop;
      mL.value = state.marginLeft;
      mR.value = state.marginRight;
      mB.value = state.marginBottom;
      linkM.checked = !!state.linkMargins;
      oW.value = state.overlapWidth;
      oH.value = state.overlapHeight;
      blankOverlap.checked = !!state.blankOverlap;
      pXIn.value = state.pagesX;
      pYIn.value = state.pagesY;
      keepAsp.checked = !!state.keepAspect;
      alignIn.value = state.imageAlign;
      showG.checked = !!state.showGuides;
      styledG.checked = !!state.styledGuides;
      showO.checked = !!state.showOverlap;
      openChk.checked = !!state.openPdf;

      if (state.imageData) {
        imgPrev.src = state.imageData;
        img = new Image();
        img.onload = drawPreview;
        img.src = state.imageData;
      }
    } catch {
      clearSavedState();
      blankOverlap.checked = false;
    }
  }

  fileIn.onchange = () => {
    const f = fileIn.files[0];
    if (!f) return;

    clearSavedState();
    resetFormToDefaults();

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
      img.onload = () => {
        drawPreview();
        saveState();
      };
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
    img.onload = () => {
      drawPreview();
      saveState();
    };
    img.src = url;
  };

  resetM.onclick = () => {
    mT.value = mL.value = mR.value = mB.value = 0;
    drawPreview();
    saveState();
  };

  incBtns.forEach(b => {
    b.onclick = () => {
      const t = document.getElementById(b.dataset.target);
      let v = +t.value;
      v = b.dataset.op === '+' ? v + 1 : Math.max(1, v - 1);
      t.value = v;
      drawPreview();
      saveState();
    };
  });

  const previewInputs = [
    sheetSz,
    orient,
    mT,
    mL,
    mR,
    mB,
    oW,
    oH,
    blankOverlap,
    pXIn,
    pYIn,
    keepAsp,
    alignIn,
    showG,
    styledG,
    showO,
    openChk
  ];

  function handlePreviewControlChange(e) {
    if (e.target === orient || e.target === keepAsp) {
      updateAlignmentControl();
    }
    if ([mT, mL, mR, mB].includes(e.target)) {
      syncMarginsFrom(e.target);
    }
    drawPreview();
    saveState();
  }

  previewInputs.forEach(el => {
    el.addEventListener('input', handlePreviewControlChange);
    el.addEventListener('change', handlePreviewControlChange);
  });

  linkM.addEventListener('change', () => {
    if (linkM.checked) syncMarginsFrom(mT);
    drawPreview();
    saveState();
  });

  newBtn.addEventListener('click', () => {
    clearSavedState();
    resetFormToDefaults();
  });

  hydrateState();
  updateAlignmentControl();
  show(current);
  saveState();
});
