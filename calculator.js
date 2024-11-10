let calculationResult;

const initializeMasks = () => {
    $('#debtAmount').mask('000.000.000.000.000,00', { reverse: true });
    $('#startDate, #endDate').mask('00-00-0000');
};

const showNotification = (message, type) => {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
};

const saveFormData = () => {
    const formData = {
        debtAmount: $('#debtAmount').val(),
        startDate: $('#startDate').val(),
        endDate: $('#endDate').val(),
        interestRate: $('#interestRate').val(),
        currentDate: $('#currentDate').prop('checked'),
        excludeEmergencyPeriods: $('#excludeEmergencyPeriods').prop('checked')
    };
    localStorage.setItem('calculatorFormData', JSON.stringify(formData));
};

const loadFormData = () => {
    const formData = JSON.parse(localStorage.getItem('calculatorFormData'));
    if (formData) {
        $('#debtAmount').val(formData.debtAmount);
        $('#startDate').val(formData.startDate);
        $('#endDate').val(formData.endDate);
        $('#interestRate').val(formData.interestRate);
        $('#currentDate').prop('checked', formData.currentDate);
        $('#excludeEmergencyPeriods').prop('checked', formData.excludeEmergencyPeriods);
    }
};

const parseDate = (dateStr) => {
    const [day, month, year] = dateStr.split('-').map(Number);
    return luxon.DateTime.fromObject({ day, month, year }, { zone: 'Europe/Chisinau' });
};

const handleFormSubmit = (e) => {
    e.preventDefault();
    let valid = true;
    $('.error-message').text('');

    const debtAmount = $('#debtAmount').val() ? parseFloat($('#debtAmount').val().replace(/\./g, '').replace(',', '.')) : 0;
    const baseRate = parseFloat($('#interestRate').val());
    const startDate = parseDate($('#startDate').val());
    const endDate = $('#currentDate').prop('checked') ? luxon.DateTime.now() : parseDate($('#endDate').val());

    if (!startDate.isValid) {
        $('#startDateError').text('Data inițială este invalidă.');
        valid = false;
    }
    if (!endDate.isValid) {
        $('#endDateError').text('Data finală este invalidă.');
        valid = false;
    }
    if (startDate >= endDate) {
        $('#startDateError').text('Data inițială trebuie să fie mai mică decât data finală.');
        $('#endDateError').text('Data finală trebuie să fie mai mare decât data inițială.');
        valid = false;
    }
    if ($('#debtAmount').val() && (isNaN(debtAmount) || debtAmount <= 0)) {
        $('#debtAmountError').text('Suma datorată trebuie să fie un număr pozitiv.');
        valid = false;
    }

    const excludeEmergencyPeriods = $('#excludeEmergencyPeriods').prop('checked');

    if (!valid) return;

    calculationResult = calculateDobanda(debtAmount, baseRate, startDate, endDate, excludeEmergencyPeriods);

    $('#displayInterest').text(formatNumber(calculationResult.totalDobanda));
    $('#displayPeriod').text(`${startDate.toLocaleString(luxon.DateTime.DATE_SHORT)} - ${endDate.toLocaleString(luxon.DateTime.DATE_SHORT)} (${calculationResult.totalDays} zile)`);
    $('#displayDebtAmount').text(formatNumber(calculationResult.totalDebt));
    $('#displayTotalDebt').text(formatNumber(calculationResult.totalDebt + calculationResult.totalDobanda));

    updateDetailedReport(calculationResult, debtAmount);

    $('#results').addClass('active');
    showNotification('Calculul a fost efectuat cu succes!', 'success');
    saveFormData();
};

document.addEventListener('DOMContentLoaded', () => {
    initializeMasks();
    loadFormData();

    $('#currentDate').change(function () {
        if (this.checked) {
            const today = luxon.DateTime.now();
            $('#endDate').val(today.toFormat('dd-MM-yyyy'));
            $('#endDate').prop('disabled', true);
        } else {
            $('#endDate').prop('disabled', false);
            $('#endDate').val('');
        }
    });

    $('#calculatorForm').submit(handleFormSubmit);

    $('button[type="reset"]').click(() => {
        $('#results').removeClass('active');
        $('#detailedReportBody').html('');
        showNotification('Formularul a fost resetat.', 'success');
        localStorage.removeItem('calculatorFormData');
    });

    $('#exportWord').click(() => {
        if (calculationResult) {
            const debtAmount = $('#debtAmount').val() ? parseFloat($('#debtAmount').val().replace(/\./g, '').replace(/,/g, '.')) : 0;
            const baseRate = parseFloat($('#interestRate').val());
            const startDate = parseDate($('#startDate').val());
            const endDate = $('#currentDate').prop('checked') ? luxon.DateTime.now() : parseDate($('#endDate').val());

            exportToWord(calculationResult, debtAmount, baseRate, startDate, endDate);
            showNotification('Raportul a fost exportat cu succes.', 'success');
        } else {
            showNotification('Vă rugăm să efectuați mai întâi calculul.', 'error');
        }
    });
});

const nbmRates = [
    { date: new Date('2020-03-04'), rate: 4.5 },
    { date: new Date('2020-03-20'), rate: 3.25 },
    { date: new Date('2020-08-06'), rate: 3 },
    { date: new Date('2020-09-09'), rate: 2.75 },
    { date: new Date('2020-11-06'), rate: 2.65 },
    { date: new Date('2021-07-30'), rate: 3.65 },
    { date: new Date('2021-09-06'), rate: 4.65 },
    { date: new Date('2021-10-05'), rate: 5.5 },
    { date: new Date('2021-12-03'), rate: 6.5 },
    { date: new Date('2022-01-13'), rate: 8.5 },
    { date: new Date('2022-02-15'), rate: 10.5 },
    { date: new Date('2022-03-16'), rate: 12.5 },
    { date: new Date('2022-05-05'), rate: 15.5 },
    { date: new Date('2022-06-03'), rate: 18.5 },
    { date: new Date('2022-08-04'), rate: 21.5 },
    { date: new Date('2022-12-05'), rate: 20 },
    { date: new Date('2023-02-07'), rate: 17 },
    { date: new Date('2023-03-20'), rate: 14 },
    { date: new Date('2023-05-11'), rate: 10 },
    { date: new Date('2023-06-20'), rate: 6 },
    { date: new Date('2023-11-07'), rate: 4.75 },
    { date: new Date('2024-02-06'), rate: 4.25 },
    { date: new Date('2024-03-21'), rate: 3.75 },
    { date: new Date('2024-07-05'), rate: 3.6 }
];

const emergencyPeriods = [
    { start: new Date('2020-03-17'), end: new Date('2020-05-15') },
    { start: new Date('2022-02-24'), end: new Date('2022-04-24') }
];

const isEmergencyPeriod = (date) => {
    return emergencyPeriods.some(period =>
        date >= period.start && date <= period.end
    );
};

const isLeapYear = (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

const getDaysInYear = (year) => {
    return isLeapYear(year) ? 366 : 365;
};

const getNbmRate = (date) => {
    for (let i = nbmRates.length - 1; i >= 0; i--) {
        if (date >= nbmRates[i].date) {
            return nbmRates[i].rate;
        }
    }
    return nbmRates[0].rate;
};

const formatNumber = (num) => {
    return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

const calculateDobanda = (debtAmount, baseRate, startDate, endDate, excludeEmergencyPeriods) => {
    let totalDobanda = 0;
    let currentDate = startDate;
    const periods = [];
    let currentPeriod = null;
    let remainingDebt = debtAmount;

    const startNewPeriod = (date, rate) => {
        if (currentPeriod) {
            currentPeriod.endDate = date.minus({ days: 1 });
            periods.push(currentPeriod);
        }
        currentPeriod = {
            startDate: date,
            endDate: null,
            days: 0,
            totalInterest: 0,
            nbmRate: rate,
            debtAmount: remainingDebt
        };
    };

    while (currentDate <= endDate) {
        if (!excludeEmergencyPeriods || !isEmergencyPeriod(currentDate.toJSDate())) {
            if (!currentPeriod || getNbmRate(currentDate.toJSDate()) !== currentPeriod.nbmRate) {
                startNewPeriod(currentDate, getNbmRate(currentDate.toJSDate()));
            }

            const totalRate = baseRate + currentPeriod.nbmRate;
            const daysInYear = getDaysInYear(currentDate.year);
            const dailyInterest = Number(((remainingDebt * (totalRate / 100)) / daysInYear).toFixed(2));

            totalDobanda += dailyInterest;
            currentPeriod.days++;
            currentPeriod.totalInterest += dailyInterest;
        }
        currentDate = currentDate.plus({ days: 1 });
    }

    if (currentPeriod) {
        currentPeriod.endDate = endDate;
        periods.push(currentPeriod);
    }

    return {
        totalDobanda: Number(totalDobanda.toFixed(2)),
        totalDebt: remainingDebt,
        periods: periods,
        totalDays: periods.reduce((sum, period) => sum + period.days, 0)
    };
};

const updateDetailedReport = (data, debtAmount) => {
    let detailedReportHTML = '';
    let yearlyTotal = 0;
    let currentYear = data.periods[0].startDate.year;
    let remainingDebt = debtAmount;

    data.periods.forEach((period, index) => {
        const periodStart = period.startDate.toLocaleString(luxon.DateTime.DATE_SHORT);
        const periodEnd = period.endDate.toLocaleString(luxon.DateTime.DATE_SHORT);
        const totalInterest = data.periods.slice(0, index + 1).reduce((sum, p) => sum + p.totalInterest, 0);

        detailedReportHTML += `
            <tr>
                <td>${periodStart} - ${periodEnd}</td>
                <td>${formatNumber(remainingDebt)}</td>
                <td></td>
                <td>${period.days}</td>
                <td>${period.nbmRate.toFixed(2)}%</td>
                <td>${formatNumber(period.totalInterest)}</td>
                <td>${formatNumber(totalInterest)}</td>
            </tr>
        `;

        yearlyTotal += period.totalInterest;

        if (period.endDate.year > currentYear || index === data.periods.length - 1) {
            detailedReportHTML += `
                <tr class="table-info">
                    <td colspan="4">Total pentru anul ${currentYear}</td>
                    <td>${formatNumber(yearlyTotal)}</td>
                    <td></td>
                </tr>
            `;
            yearlyTotal = 0;
            currentYear = period.endDate.year;
        }
    });

    detailedReportHTML += `
        <tr class="table-success">
            <td colspan="3">Total general</td>
            <td>${data.totalDays}</td>
            <td></td>
            <td>${formatNumber(data.totalDobanda)}</td>
            <td></td>
        </tr>
    `;

    $('#detailedReportBody').html(detailedReportHTML);
};

const exportToWord = (calculationResult, debtAmount, baseRate, startDate, endDate) => {
    let content = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Raport detaliat</title>
        </head>
        <body>
            <h1 style='font-size: 12pt; text-align:left;'>Detaliat: сalculul dobânzii de întârziere</h1>
            <p style='font-size: 12pt; text-align:left;'><i>*Valoarea este rotunjită la 2 zecimale*</i></p>
            <h2 style='font-size: 12pt; text-align:left;'>Formula:</h2>
            <p style='font-size: 12pt; text-align:left;'>(D * (X + 5%)) * Y<br>---------------------<br>365</p>
            <p style='font-size: 12pt; text-align:left;'>D -- suma datoriei<br>
            X -- rata de bază<br>
            5% - procentul de întârziere peste rata dobânzii, conform art. 874 CC RM<br>
            365 -- numîrul de zile într-un an<br>
            Y -- numărul de zile de întârziere</p>
            <table border='1' style='border-collapse:collapse;width:100%;'>
                <tr>
                    <th>Dobânda de întârziere</th>
                    <td>${formatNumber(calculationResult.totalDobanda)}</td>
                </tr>
                <tr>
                    <th>Perioada</th>
                    <td>${startDate.toLocaleString(luxon.DateTime.DATE_SHORT)} - ${endDate.toLocaleString(luxon.DateTime.DATE_SHORT)}</td>
                </tr>
                <tr>
                    <th>Datorie</th>
                    <td>${formatNumber(debtAmount)}</td>
                </tr>
            </table>
            <br>
            <table border='1' style='border-collapse:collapse;width:100%;'>
                <tr>
                    <th>Perioada</th>
                    <th>Datorie</th>
                    <th>Sume achitate / Adăugări datorii</th>
                    <th>Numărul de zile</th>
                    <th>Rata de bază</th>
                    <th>Dobânda</th>
                    <th>Dobânda total</th>
                </tr>
    `;

    let yearlyTotal = 0;
    let currentYear = startDate.year;
    let remainingDebt = debtAmount;

    calculationResult.periods.forEach((period, index) => {
        const periodStart = period.startDate.toLocaleString(luxon.DateTime.DATE_SHORT);
        const periodEnd = period.endDate.toLocaleString(luxon.DateTime.DATE_SHORT);
        const totalInterest = calculationResult.periods.slice(0, index + 1).reduce((sum, p) => sum + p.totalInterest, 0);

        content += `
            <tr>
                <td>${periodStart} - ${periodEnd}</td>
                <td>${formatNumber(remainingDebt)}</td>
                <td></td>
                <td>${period.days}</td>
                <td>${period.nbmRate.toFixed(2)}%</td>
                <td>${formatNumber(period.totalInterest)}</td>
                <td>${formatNumber(totalInterest)}</td>
            </tr>
        `;

        yearlyTotal += period.totalInterest;

        if (period.endDate.year > currentYear || index === calculationResult.periods.length - 1) {
            content += `
                <tr>
                    <td colspan='4'>Total pentru anul ${currentYear}</td>
                    <td>${formatNumber(yearlyTotal)}</td>
                    <td></td>
                </tr>
            `;
            yearlyTotal = 0;
            currentYear = period.endDate.year;
        }
    });

    content += `
            <tr>
                <td colspan='3'>Total general</td>
                <td>${calculationResult.totalDays}</td>
                <td></td>
                <td>${formatNumber(calculationResult.totalDobanda)}</td>
                <td></td>
            </tr>
        </table>
        </body>
        </html>
    `;

    const blob = new Blob([content], { type: "application/msword;charset=utf-8" });
    saveAs(blob, "raport_detaliat.doc");
};
