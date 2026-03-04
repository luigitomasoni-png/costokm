document.addEventListener('DOMContentLoaded', () => {
    // ---- TABS LOGIC ----
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewSections = document.querySelectorAll('.view-section');
    const resultContainer = document.getElementById('result-container');
    const resultDettaglio = document.getElementById('percorso-dettaglio');
    const btnMaps = document.getElementById('btn-maps');

    let currentMode = 'manuale'; // manuale, semplice, multi
    const HQ_ADDRESS = "Via Monte Rosa 10, Olgiate Molgora, Italia";
    let lastRouteNames = [];

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes from buttons and sections
            tabBtns.forEach(b => b.classList.remove('active'));
            viewSections.forEach(s => s.classList.remove('active'));

            // Add active to current button and target section
            btn.classList.add('active');
            const target = btn.getAttribute('data-target');
            document.getElementById(target).classList.add('active');

            // hide result across tabs to avoid confusion
            resultContainer.classList.add('hidden');

            if (target === 'view-manuale') currentMode = 'manuale';
            if (target === 'view-semplice') currentMode = 'semplice';
            if (target === 'view-multi') currentMode = 'multi';
        });
    });

    // ---- AUTO-RECALCULATE ON MEZZO CHANGE ----
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // Se il risultato è già visibile, ricalcola automaticamente
            if (!resultContainer.classList.contains('hidden')) {
                const activeForm = document.querySelector('.view-section.active form');
                if (activeForm) {
                    activeForm.requestSubmit();
                }
            }
        });
    });

    // ---- FUNZIONE CALCOLO PREZZO (COMUNE) ----
    function applyPricing(km, mezzo) {
        let base = (mezzo === 'ABZ') ? 50 : 40;
        let cost = base;
        if (km > 15) {
            cost += (km - 15);
        }
        return Math.ceil(cost);
    }

    // ---- VISTA 1: MANUALE (KM CONTACHILOMETRI) ----
    const formManuale = document.getElementById('form-manuale');
    formManuale.addEventListener('submit', (e) => {
        e.preventDefault();
        const startKm = parseFloat(document.getElementById('km-partenza').value);
        const endKm = parseFloat(document.getElementById('km-arrivo').value);
        const mezzoRadio = formManuale.querySelector('input[name="mezzo-manuale"]:checked');
        const mezzo = mezzoRadio ? mezzoRadio.value : null;

        if (isNaN(startKm) || isNaN(endKm) || !mezzo) {
            showToast("Compila tutti i campi correttamente.");
            return;
        }

        if (endKm < startKm) {
            showToast("I Km di Arrivo devono essere maggiori dei Km di Partenza.");
            return;
        }

        // Calcolo della distanza (Solo andata e ritorno se moltiplicato per 2)
        const percorsoSingolo = (endKm - startKm);

        // COME RICHIESTO: l'APP li raddoppia e fa il calcolo
        const totalKm = percorsoSingolo * 2;

        const price = applyPricing(totalKm, mezzo);

        document.getElementById('km-totali').textContent = totalKm + " Km";
        document.getElementById('prezzo').textContent = price + " €";

        resultDettaglio.innerHTML = `
            <div style="margin-bottom:2px;"><strong>Distanza km/Inserita:</strong> ${percorsoSingolo} Km</div>
            <div><strong>Fattore A/R:</strong> Moltiplicato x 2.0</div>
        `;

        btnMaps.classList.add('hidden'); // Non usiamo maps in questa vista
        resultContainer.classList.remove('hidden');

        // Scroll rapido in basso
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });


    // ---- VISTA 2: SEMPLICE A/R (MAPPE) -----
    const formSemplice = document.getElementById('form-semplice');
    formSemplice.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pCitta = document.getElementById('partenza-semplice-citta').value.trim();
        const pVia = document.getElementById('partenza-semplice-via').value.trim();
        const aCitta = document.getElementById('arrivo-semplice-citta').value.trim();
        const aVia = document.getElementById('arrivo-semplice-via').value.trim();

        const partenza = pVia ? `${pVia}, ${pCitta}` : pCitta;
        const arrivo = aVia ? `${aVia}, ${aCitta}` : aCitta;

        const mezzoRadio = formSemplice.querySelector('input[name="mezzo-semplice"]:checked');
        const mezzo = mezzoRadio ? mezzoRadio.value : null;

        if (!pCitta || !aCitta || !mezzo) {
            showToast("Compila almeno le città e seleziona il mezzo.");
            return;
        }

        const btnCalc = formSemplice.querySelector('.btn-calc');
        btnCalc.disabled = true;
        btnCalc.textContent = "⏳ Calcolo...";

        try {
            const hqCoords = { lat: 45.7271, lon: 9.4024 }; // Olgiate Sede
            const partCoords = await getCoordinates(partenza);
            if (!partCoords) throw new Error("Comune di Partenza non trovato.");
            const arrCoords = await getCoordinates(arrivo);
            if (!arrCoords) throw new Error("Comune di Arrivo non trovato.");

            const dist1 = await getRoadDistance(hqCoords, partCoords);
            const dist2 = await getRoadDistance(partCoords, arrCoords);
            const dist3 = await getRoadDistance(arrCoords, hqCoords);

            const totalKm = Math.ceil(dist1 + dist2 + dist3);
            const price = applyPricing(totalKm, mezzo);

            document.getElementById('km-totali').textContent = totalKm + " Km";
            document.getElementById('prezzo').textContent = price + " €";

            let detailHtml = "";
            if (dist1 > 0.1) {
                detailHtml += `<div style="margin-bottom: 4px;"><strong>Sede CRI</strong> &rarr; ${escapeHtml(displayName(partenza))} (${dist1.toFixed(1)} km)</div>`;
            }
            detailHtml += `<div style="margin-bottom: 4px;"><strong>${escapeHtml(displayName(partenza))}</strong> &rarr; ${escapeHtml(displayName(arrivo))} (${dist2.toFixed(1)} km)</div>`;
            if (dist3 > 0.1) {
                detailHtml += `<div><strong>${escapeHtml(displayName(arrivo))}</strong> &rarr; Sede CRI (${dist3.toFixed(1)} km)</div>`;
            }
            resultDettaglio.innerHTML = detailHtml;

            lastRouteNames = [HQ_ADDRESS, partenza, arrivo, HQ_ADDRESS];
            btnMaps.classList.remove('hidden');
            resultContainer.classList.remove('hidden');

            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        } catch (error) {
            showToast(error.message);
        } finally {
            btnCalc.disabled = false;
            btnCalc.innerHTML = "Calcola Preventivo";
        }
    });

    // ---- VISTA 3: MULTI TAPPA (MAPPE) ----
    const multiContainer = document.getElementById('multi-stops-container');
    document.getElementById('btn-add-stop').addEventListener('click', () => {
        const rowCount = multiContainer.querySelectorAll('.multi-stop-row').length + 1;
        const row = document.createElement('div');
        row.className = 'multi-stop-row highlight-partenza'; // Stesso style verde
        row.innerHTML = `
            <label>🟢 Tappa ${rowCount}</label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <input type="text" class="stop-input-citta" placeholder="Città" required>
                <input type="text" class="stop-input-via" placeholder="Via e civico (opzionale)">
            </div>
            <button type="button" class="remove-stop">&times;</button>
        `;
        multiContainer.appendChild(row);

        row.querySelector('.remove-stop').addEventListener('click', () => {
            row.remove();
            reindexMultiStops();
        });
    });

    function reindexMultiStops() {
        const rows = multiContainer.querySelectorAll('.multi-stop-row');
        rows.forEach((row, index) => {
            row.querySelector('label').innerHTML = `🟢 Tappa ${index + 1}`;
        });
    }

    const formMulti = document.getElementById('form-multi');
    formMulti.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mezzoRadio = formMulti.querySelector('input[name="mezzo-multi"]:checked');
        const mezzo = mezzoRadio ? mezzoRadio.value : null;

        const stopRows = Array.from(multiContainer.querySelectorAll('.multi-stop-row'));
        const inputs = stopRows.map(row => {
            const citta = row.querySelector('.stop-input-citta').value.trim();
            const via = row.querySelector('.stop-input-via').value.trim();
            return via ? `${via}, ${citta}` : citta;
        }).filter(v => v !== '');

        if (inputs.length === 0 || !mezzo) {
            showToast("Inserisci almeno una tappa e seleziona il mezzo.");
            return;
        }

        const btnCalc = formMulti.querySelector('.btn-calc');
        btnCalc.disabled = true;
        btnCalc.textContent = "⏳ Calcolo Tappe...";

        try {
            const hqCoords = { lat: 45.7271, lon: 9.4024 };

            // Resolve all coordinates
            let coordsList = [];
            for (let i = 0; i < inputs.length; i++) {
                const c = await getCoordinates(inputs[i]);
                if (!c) throw new Error(`Non ho trovato: ${inputs[i]}`);
                coordsList.push(c);
            }

            // Calculate distances
            // Sede -> Tappa 1
            let totalKm = 0;
            let currentStr = "";
            let segments = [];

            let d1 = await getRoadDistance(hqCoords, coordsList[0]);
            totalKm += d1;
            if (d1 > 0.1) {
                segments.push(`<strong>Sede CRI</strong> &rarr; ${escapeHtml(displayName(inputs[0]))} (${d1.toFixed(1)} km)`);
            }

            // Tappa N -> Tappa N+1
            for (let i = 0; i < coordsList.length - 1; i++) {
                let d = await getRoadDistance(coordsList[i], coordsList[i + 1]);
                totalKm += d;
                segments.push(`<strong>${escapeHtml(displayName(inputs[i]))}</strong> &rarr; ${escapeHtml(displayName(inputs[i + 1]))} (${d.toFixed(1)} km)`);
            }

            // Tappa N -> Sede
            let dLast = await getRoadDistance(coordsList[coordsList.length - 1], hqCoords);
            totalKm += dLast;
            if (dLast > 0.1) {
                segments.push(`<strong>${escapeHtml(displayName(inputs[inputs.length - 1]))}</strong> &rarr; Sede CRI (${dLast.toFixed(1)} km)`);
            }

            totalKm = Math.ceil(totalKm);
            const price = applyPricing(totalKm, mezzo);

            document.getElementById('km-totali').textContent = totalKm + " Km";
            document.getElementById('prezzo').textContent = price + " €";

            resultDettaglio.innerHTML = segments.map(s => `<div style="margin-bottom:4px;">${s}</div>`).join('');

            lastRouteNames = [HQ_ADDRESS, ...inputs, HQ_ADDRESS];
            btnMaps.classList.remove('hidden');
            resultContainer.classList.remove('hidden');

            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        } catch (error) {
            showToast(error.message);
        } finally {
            btnCalc.disabled = false;
            btnCalc.innerHTML = "Calcola Intero Percorso";
        }

    });

    // MAPS BTN
    btnMaps.addEventListener('click', () => {
        if (lastRouteNames.length > 0) {
            const path = lastRouteNames.map(x => encodeURIComponent(x)).join('/');
            window.open(`https://www.google.com/maps/dir/${path}`, '_blank');
        }
    });

    // ---- FUNZIONI HELPER ----
    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
    }

    function displayName(addr) {
        if (!addr) return "";
        if (addr.toLowerCase().includes("monte rosa")) return "Sede CRI";
        return addr;
    }

    function escapeHtml(unsafe) {
        return unsafe.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function getCoordinates(addr) {
        if (addr.toLowerCase().includes("monte rosa")) return { lat: 45.7271, lon: 9.4024 };
        try {
            let searchAddr = addr.toLowerCase().includes('italia') ? addr : addr + ', Italia';
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddr)}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            }
        } catch (e) {
            console.error("Errore Geocoding:", e);
        }
        return null;
    }

    async function getRoadDistance(s, e) {
        try {
            if (Math.abs(s.lat - e.lat) < 0.0001 && Math.abs(s.lon - e.lon) < 0.0001) return 0;
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${s.lon},${s.lat};${e.lon},${e.lat}?overview=false`);
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                return data.routes[0].distance / 1000;
            }
        } catch (e) {
            console.error("Errore Routing:", e);
        }
        throw new Error("Impossibile calcolare il percorso. Verifica gli indirizzi inseriti.");
    }
});
