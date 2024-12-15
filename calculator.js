// Check dependencies
document.addEventListener('DOMContentLoaded', function() {
    const requiredDependencies = ['jQuery', 'luxon', 'toastr', 'saveAs'];
    const missing = requiredDependencies.filter(dep => {
        return typeof window[dep] === 'undefined' && 
               typeof window[dep.toLowerCase()] === 'undefined';
    });

    if (missing.length) {
        document.getElementById('dependencyCheck').style.display = 'block';
        console.error('Missing dependencies:', missing);
        return;
    }
});

// Constants
const NBM_RATES = [
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
].sort((a, b) => a.date - b.date);

const EMERGENCY_PERIODS = [
    { start: new Date('2020-03-17'), end: new Date('2020-05-15') },
    { start: new Date('2022-02-24'), end: new Date('2022-04-24') }
];

// Utils
const Utils = {
    date: {
        parse(dateStr) {
            if (!dateStr || !/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
                return null;
            }

            const [day, month, year] = dateStr.split('-').map(Number);
            const date = luxon.DateTime.fromObject(
                { day, month, year }, 
                { zone: 'Europe/Chisinau' }
            );

            // Проверка валидности даты
            if (!date.isValid) {
                console.error('Invalid date:', dateStr);
                return null;
            }

            return date;
        },

        format(date) {
            return date.toFormat('dd-MM-yyyy');
        },

        formatForDisplay(date) {
            return date.toFormat('dd.MM.yyyy');
        },

        getDaysBetween(startDate, endDate) {
            return Math.round(endDate.diff(startDate, 'days').days);
        },

        isValidDate(dateStr) {
            const date = this.parse(dateStr);
            return date?.isValid ?? false;
        }
    },

    number: {
        format(num) {
            if (num === null || num === undefined) {
                return '0,00';
            }
            return new Intl.NumberFormat('ro-RO', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true
            }).format(Math.abs(num));
        },

        parse(amountStr) {
            if (!amountStr?.trim()) return 0;
            const parsed = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
            return isNaN(parsed) ? 0 : parsed;
        },

        round(num, decimals = 2) {
            const factor = Math.pow(10, decimals);
            return Math.round(num * factor) / factor;
        }
    },

    validation: {
        validateOperation(operation) {
            const errors = [];
            
            if (!operation.date?.isValid) {
                errors.push('Data este invalidă');
            }
            
            if (operation.credit < 0 || operation.debit < 0) {
                errors.push('Sumele nu pot fi negative');
            }
            
            if (operation.credit > 0 && operation.debit > 0) {
                errors.push('Nu poate exista simultan credit și debit');
            }

            return errors;
        },

        validateOperations(operations) {
            if (!operations?.length) {
                throw new Error('Nu există operațiuni pentru calcul');
            }

            if (!operations.some(op => op.debit > 0)) {
                throw new Error('Este necesară cel puțin o operațiune de debit');
            }

            const errors = operations.flatMap((op, index) => 
                this.validateOperation(op).map(err => `Rândul ${index + 1}: ${err}`)
            );

            if (errors.length) {
                throw new Error(errors.join('\n'));
            }
        }
    }
};

// Calculator Class
class Calculator {
    constructor(baseRate, excludeEmergencyPeriods) {
        this.baseRate = baseRate;
        this.excludeEmergencyPeriods = excludeEmergencyPeriods;
    }

    getNbmRate(date) {
        if (!NBM_RATES?.length) {
            throw new Error('Ratele BNM nu sunt disponibile');
        }

        const jsDate = date.toJSDate();
        const applicableRate = NBM_RATES
            .filter(r => r.date <= jsDate)
            .sort((a, b) => b.date - a.date)[0];

        return applicableRate?.rate ?? NBM_RATES[0].rate;
    }

    isInEmergencyPeriod(date) {
        if (!this.excludeEmergencyPeriods) return false;
        const jsDate = date.toJSDate();
        return EMERGENCY_PERIODS.some(period => 
            jsDate >= period.start && jsDate <= period.end
        );
    }

    calculateDailyInterest(amount, nbmRate, days, startDate) {
        const totalRate = (this.baseRate + nbmRate) / 100;
        const daysInYear = startDate.year % 4 === 0 ? 366 : 365;
        return Utils.number.round((amount * totalRate * days) / daysInYear);
    }

    calculateWithPayments(operations, endDate) {
        Utils.validation.validateOperations(operations);
        
        operations.sort((a, b) => a.date < b.date ? -1 : 1);
        
        let currentDebt = operations[0].debit;
        let totalInterest = 0;
        const periods = [];
        let currentDate = operations[0].date;

        for (let i = 1; i <= operations.length; i++) {
            const nextOperation = i < operations.length ? operations[i] : null;
            const periodEndDate = nextOperation ? nextOperation.date : endDate;
            
            let tempDate = currentDate;
            while (tempDate < periodEndDate) {
                const currentNbmRate = this.getNbmRate(tempDate);
                const nextRateChange = NBM_RATES.find(r => 
                    r.date > tempDate.toJSDate() && r.date <= periodEndDate.toJSDate()
                );
                
                const subPeriodEnd = nextRateChange 
                    ? luxon.DateTime.fromJSDate(nextRateChange.date) 
                    : periodEndDate;
                
                const days = Utils.date.getDaysBetween(tempDate, subPeriodEnd);
                
                if (days > 0 && currentDebt > 0 && !this.isInEmergencyPeriod(tempDate)) {
                    const interest = this.calculateDailyInterest(
                        currentDebt,
                        currentNbmRate,
                        days,
                        tempDate
                    );

                    periods.push({
                        startDate: tempDate,
                        endDate: subPeriodEnd,
                        debtAmount: currentDebt,
                        days,
                        nbmRate: currentNbmRate,
                        baseRate: this.baseRate,
                        interest: Utils.number.round(interest),
                        totalInterest: Utils.number.round(totalInterest + interest)
                    });

                    totalInterest = Utils.number.round(totalInterest + interest);
                }

                tempDate = subPeriodEnd;
            }

            if (nextOperation) {
                if (nextOperation.credit) {
                    currentDebt = Math.max(0, currentDebt - nextOperation.credit);
                }
                if (nextOperation.debit) {
                    currentDebt += nextOperation.debit;
                }
                currentDate = nextOperation.date;
            }
        }

        return {
            periods,
            totalInterest: Utils.number.round(totalInterest),
            totalDays: periods.reduce((sum, p) => sum + p.days, 0),
            finalDebt: currentDebt,
            startDate: operations[0].date,
            endDate
        };
    }
}

// UI Handling
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function initializeInputMasks() {
    $('.date-input').mask('00-00-0000', {
        placeholder: 'DD-MM-YYYY',
        clearIfNotMatch: true
    });

    $('.amount-input').mask('#.##0,00', {
        reverse: true,
        placeholder: '0,00',
        selectOnFocus: true
    });
}

function updateRowNumbers() {
    $('#operationsTable tbody tr').each(function(index) {
        $(this).find('.row-number').text(index + 1);
    });
}

function updateTotals() {
    let totalCredit = 0;
    let totalDebit = 0;

    $('#operationsTable tbody tr').each(function() {
        const credit = Utils.number.parse($(this).find('input[name="credit"]').val()) || 0;
        const debit = Utils.number.parse($(this).find('input[name="debit"]').val()) || 0;
        totalCredit += credit;
        totalDebit += debit;
    });

    $('#totalCredit').text(Utils.number.format(totalCredit));
    $('#totalDebit').text(Utils.number.format(totalDebit));
    
    const saldo = totalDebit - totalCredit;
    $('#totalSaldo')
        .text(Utils.number.format(Math.abs(saldo)))
        .removeClass('positive negative')
        .addClass(saldo > 0 ? 'positive' : saldo < 0 ? 'negative' : '');
}

function updateProgressBar(result) {
    const totalPayment = result.finalDebt + result.totalInterest;
    const interestPercent = (result.totalInterest / totalPayment) * 100;
    const debtPercent = (result.finalDebt / totalPayment) * 100;

    $('#progressFillInterest').css('width', `${interestPercent}%`);
    $('#progressFillDebt').css('width', `${debtPercent}%`);
    $('#progressInterestPercent').text(`${Math.round(interestPercent)}%`);
    $('#progressDebtPercent').text(`${Math.round(debtPercent)}%`);
}

function updateResultsDisplay(result) {
    $('#initialAmount').text(Utils.number.format(result.periods[0].debtAmount));
    $('#totalPeriod').text(
        `${Utils.date.formatForDisplay(result.startDate)} - ${Utils.date.formatForDisplay(result.endDate)}`
    );
    $('#totalDays').text(result.totalDays);
    $('#totalInterest').text(Utils.number.format(result.totalInterest));
    $('#remainingDebt').text(Utils.number.format(result.finalDebt));
    $('#totalPayment').text(Utils.number.format(result.finalDebt + result.totalInterest));

    const periodsHtml = result.periods.map(period => `
        <div class="period-block">
            <p><strong>Perioada:</strong> ${Utils.date.formatForDisplay(period.startDate)} - ${Utils.date.formatForDisplay(period.endDate)}</p>
            <p><strong>Suma de bază:</strong> ${Utils.number.format(period.debtAmount)} lei</p>
            <p><strong>Rata de bază BNM:</strong> ${period.nbmRate}%</p>
            <p><strong>Zile:</strong> ${period.days}</p>
            <p><strong>Dobânda calculată:</strong> ${Utils.number.format(period.interest)} lei</p>
        </div>
    `).join('');
    
    $('#periodCalculations').html(periodsHtml);
    updateProgressBar(result);
}

function resetResults() {
    $('#initialAmount, #totalDays, #totalInterest, #remainingDebt, #totalPayment').text('0,00');
    $('#totalPeriod').text('');
    $('#periodCalculations').empty();
    $('#progressFillInterest, #progressFillDebt').css('width', '0%');
    $('#progressInterestPercent, #progressDebtPercent').text('0%');
}

function exportToWord() {
    try {
        showLoading();

        const content = document.getElementById('results').cloneNode(true);
        content.querySelector('.export-buttons')?.remove();
        
        const template = `
            <!DOCTYPE html>
            <html lang="ro">
            <head>
                <meta charset="utf-8">
                <title>Calculator Dobânda</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif;
                        line-height: 1.5;
                        margin: 20px;
                    }
                    .info-group { margin-bottom: 20px; }
                    .info-row { 
                        margin-bottom: 10px;
                        padding: 8px;
                        background-color: #f8f9fa;
                    }
                    .period-block { 
                        margin-bottom: 15px;
                        padding: 15px;
                        background-color:background-color: #f8f9fa;
                        border: 1px solid #dee2e6;
                    }
                    .info-label { font-weight: 500; }
                    .animated-value { 
                        font-family: Consolas, monospace;
                        font-weight: 600;
                    }
                    .info-unit { color: #666; }
                    h3, h4 { 
                        color: #333;
                        margin-top: 20px;
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                ${content.innerHTML}
            </body>
            </html>
        `;

        const blob = new Blob([template], { type: 'application/msword' });
        saveAs(blob, `calculator-dobanda-${luxon.DateTime.now().toFormat('dd-MM-yyyy')}.doc`);
        
        toastr.success('Documentul a fost exportat cu succes');
    } catch (error) {
        console.error('Export error:', error);
        toastr.error('Eroare la exportarea documentului');
    } finally {
        hideLoading();
    }
}

// Event Handlers
$(document).ready(function() {
    let calculator = null;

    // Initialize tooltips and input masks
    initializeInputMasks();

    // Add row handler
    $('#addRowBtn').on('click', function() {
        const newRow = `
            <tr>
                <td class="row-number"></td>
                <td><input type="text" name="document" class="form-control"></td>
                <td><input type="text" name="date" class="form-control date-input" placeholder="DD-MM-YYYY" data-tooltip="Format: ZZ-LL-AAAA"></td>
                <td><input type="text" name="credit" class="form-control amount-input text-right" placeholder="0,00" data-tooltip="Introduceți suma plătită"></td>
                <td><input type="text" name="debit" class="form-control amount-input text-right" placeholder="0,00" data-tooltip="Introduceți suma datorată"></td>
                <td><button type="button" class="delete-row btn btn-link text-danger" aria-label="Șterge rândul">&times;</button></td>
            </tr>
        `;
        $('#operationsTable tbody').append(newRow);
        initializeInputMasks();
        updateRowNumbers();
    });

    // Delete row handler
    $(document).on('click', '.delete-row', function() {
        const tbody = $('#operationsTable tbody');
        if (tbody.find('tr').length > 1) {
            $(this).closest('tr').remove();
            updateRowNumbers();
            updateTotals();
        } else {
            toastr.warning('Nu puteți șterge ultimul rând');
        }
    });

    // Update totals on input
    $(document).on('input', '.amount-input', updateTotals);

    // Calculate handler
    $('#calculateBtn').on('click', async function() {
        try {
            showLoading();

            const operations = $('#operationsTable tbody tr').map(function() {
                return {
                    date: Utils.date.parse($(this).find('input[name="date"]').val()),
                    credit: Utils.number.parse($(this).find('input[name="credit"]').val()),
                    debit: Utils.number.parse($(this).find('input[name="debit"]').val())
                };
            }).get().filter(op => op.date && (op.credit || op.debit));

            if (!operations.length || !operations.some(r => r.debit)) {
                toastr.error('Introduceți suma inițială (Debit)');
                return;
            }

            calculator = new Calculator(
                parseFloat($('#interestRate').val()),
                $('#excludeEmergencyPeriods').prop('checked')
            );

            const result = calculator.calculateWithPayments(operations, luxon.DateTime.now());
            updateResultsDisplay(result);
            toastr.success('Calculul a fost efectuat cu succes');
        } catch (error) {
            console.error('Calculation error:', error);
            toastr.error(error.message || 'Eroare la calculare');
        } finally {
            hideLoading();
        }
    });

    // Reset handler
    $('#resetBtn').on('click', function() {
        $('#operationsTable tbody').html(`
            <tr>
                <td class="row-number">1</td>
                <td><input type="text" name="document" class="form-control"></td>
                <td><input type="text" name="date" class="form-control date-input" placeholder="DD-MM-YYYY" data-tooltip="Format: ZZ-LL-AAAA"></td>
                <td><input type="text" name="credit" class="form-control amount-input text-right" placeholder="0,00" data-tooltip="Introduceți suma plătită"></td>
                <td><input type="text" name="debit" class="form-control amount-input text-right" placeholder="0,00" data-tooltip="Introduceți suma datorată"></td>
                <td><button type="button" class="delete-row btn btn-link text-danger" aria-label="Șterge rândul">&times;</button></td>
            </tr>
        `);
        initializeInputMasks();
        updateTotals();
        resetResults();
        calculator = null;
        toastr.info('Datele au fost resetate');
    });

    // Export handler
    $('#exportBtn').on('click', exportToWord);

    // Initialize toastr options
    toastr.options = {
        closeButton: true,
        progressBar: true,
        positionClass: "toast-top-right",
        timeOut: 3000
    };
});