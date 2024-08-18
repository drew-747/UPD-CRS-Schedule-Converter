document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const convertICSButton = document.getElementById('convertICS');
    const convertCSVButton = document.getElementById('convertCSV');
    const convertJSONButton = document.getElementById('convertJSON');

    let pageContent = '';

    function setStatus(message) {
        statusElement.textContent = message;
    }

    function loadPageContent(callback) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: () => document.documentElement.outerHTML
            }, (results) => {
                if (chrome.runtime.lastError) {
                    setStatus('Error: ' + chrome.runtime.lastError.message);
                } else if (results && results[0]) {
                    pageContent = results[0].result;
                    callback();
                }
            });
        });
    }

    function extractSchedule() {
        const parser = new DOMParser();
        const doc = parser.parseFromString(pageContent, 'text/html');
        const scheduleDiv = doc.getElementById('div-schedule');
        if (!scheduleDiv) {
            console.error('Schedule div not found');
            return [];
        }
    
        const scheduleTable = scheduleDiv.querySelector('table#reg_schedule_table');
        const schedule = [];
    
        if (scheduleTable) {
            const rows = scheduleTable.querySelectorAll('tbody tr');
            const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            
            days.forEach(day => {
                let daySchedule = [];
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 7) {
                        const timeSlot = cells[0].querySelector('.scheduletable_class').textContent.trim();
                        const dayIndex = days.indexOf(day) + 1;
                        const cellContent = cells[dayIndex].innerHTML;
                        const greenCheckEntries = cellContent.match(/<span class="scheduletable_text">[\s\S]*?<img class="enlisted_icon"[\s\S]*?<span class="scheduletable_class">(.*?)<\/span>/g);
                        
                        if (greenCheckEntries) {
                            greenCheckEntries.forEach(entry => {
                                const className = entry.match(/<span class="scheduletable_class">(.*?)<\/span>/)[1].trim();
                                daySchedule.push({
                                    time: timeSlot,
                                    class: className
                                });
                            });
                        }
                    }
                });
                
                const mergedDaySchedule = mergeSameClasses(daySchedule);
                mergedDaySchedule.forEach(item => {
                    schedule.push({
                        time: item.time,
                        day: day,
                        class: item.class
                    });
                });
            });
        }
    
        return schedule;
    }

    function mergeSameClasses(daySchedule) {
        const merged = [];
        let current = null;

        daySchedule.forEach(item => {
            if (!current || current.class !== item.class) {
                if (current) {
                    merged.push(current);
                }
                current = { ...item };
            } else {
                const [currentEnd] = current.time.split(' to ')[1].split(' ');
                const [nextStart, nextEnd] = item.time.split(' to ');
                if (currentEnd === nextStart) {
                    current.time = `${current.time.split(' to ')[0]} to ${nextEnd}`;
                } else {
                    merged.push(current);
                    current = { ...item };
                }
            }
        });

        if (current) {
            merged.push(current);
        }

        return merged;
    }
    
    function getDayAbbreviation(day) {
        const dayAbbreviations = {
            'mon': 'MO',
            'tue': 'TU',
            'wed': 'WE',
            'thu': 'TH',
            'fri': 'FR',
            'sat': 'SA',
            'sun': 'SU'
        };
        return dayAbbreviations[day] || '';
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], {type: mimeType});
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        });
    }

    function convertToICS(schedule) {
        const { startDate, endDate } = getSemesterDates();
        let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//UPD CRS Schedule Converter//EN\n';
        schedule.forEach(item => {
            const dayAbbr = getDayAbbreviation(item.day);
            const [startTimeStr, endTimeStr] = item.time.split(' to ');
            const start = getTimeRange(startTimeStr + ' to ' + endTimeStr).start;
            const end = getTimeRange(startTimeStr + ' to ' + endTimeStr).end;
            const eventStart = getNextDayOfWeek(startDate, dayAbbr);
            icsContent += 'BEGIN:VEVENT\n';
            icsContent += `SUMMARY:${item.class}\n`;
            icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${dayAbbr};UNTIL=${formatDate(endDate)}T235959Z\n`;
            icsContent += `DTSTART:${formatDate(eventStart)}T${start}\n`;
            icsContent += `DTEND:${formatDate(eventStart)}T${end}\n`;
            icsContent += 'END:VEVENT\n';
        });
        icsContent += 'END:VCALENDAR';
        return icsContent;
    }

    function getSemesterDates() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        let startDate, endDate;

        if (month >= 7 && month <= 11) { // Aug - Dec
            startDate = new Date(year, 7, 1); // August 1st
            endDate = new Date(year, 11, 31); // December 31st
        } else if (month >= 0 && month <= 5) { // Jan - Jun
            startDate = new Date(year, 0, 1); // January 1st
            endDate = new Date(year, 5, 30); // June 30th
        } else { // Jun - Jul
            startDate = new Date(year, 5, 1); // June 1st
            endDate = new Date(year, 6, 31); // July 31st
        }

        return { startDate, endDate };
    }

    function getNextDayOfWeek(startDate, dayAbbr) {
        const daysOfWeek = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const targetDay = daysOfWeek.indexOf(dayAbbr);
        const startDay = startDate.getDay();
        const daysToAdd = (targetDay + 7 - startDay) % 7;
        const result = new Date(startDate);
        result.setDate(result.getDate() + daysToAdd);
        return result;
    }

    function formatDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('T')[0];
    }

    // function that parses any timestring to HHMMSS format
    function parseTime(timeString)
    {
        let treatedTimeString = timeString;
        // convert HH:MMXM to HHMM
        treatedTimeString = treatedTimeString.replace(":", "");

        // gets hour
        const untreatedHour = parseInt(timeString.substring(0,2));

        if (timeString.endsWith("PM") && untreatedHour != 12)
        {
            // afternoon 1PM-11:59PM
            treatedTimeString = treatedTimeString.replace("PM", "");
            let treatedHour = parseInt(treatedTimeString.substring(0,2)) + 12;
            return `${treatedHour}${treatedTimeString.substring(2,4)}00`;
        }
        else if (timeString.endsWith("AM") && untreatedHour === 12)
        {
            // midnight 12AM-12:59AM
            treatedTimeString = treatedTimeString.replace("AM", "");
            treatedTimeString += "00";
            return treatedTimeString.replace("12","00");   
        }
        else if (timeString.endsWith("PM") && untreatedHour == 12)
        {
            // lunch 12PM-12:59PM
            treatedTimeString = treatedTimeString.replace("PM", "");
            treatedTimeString += "00";
            return treatedTimeString;   
        }
        else
        {
            // morning 1AM-11:59AM
            treatedTimeString = treatedTimeString.replace("AM", "");
            treatedTimeString += "00";
            return treatedTimeString;   
        }
        
    }

    function getTimeRange(timeString) {
        const [start, end] = timeString.split(' to ');

        // time may now adapt to non-standard time ranges
        return {
            start: parseTime(start),
            end: parseTime(end)
        };
    }

    
    function convertToCSV(schedule) {
        let csvContent = 'Day,Start Time,End Time,Class\n';
        schedule.forEach(item => {
            const [startTime, endTime] = (item.time || '').split(' to ');
            csvContent += `"${item.day || ''}","${startTime || ''}","${endTime || ''}","${item.class || ''}"\n`;
        });
        return csvContent;
    }
    
    function convertToJSON(schedule) {
        const formattedSchedule = schedule.map(item => {
            const [startTime, endTime] = (item.time || '').split(' to ');
            return {
                day: item.day || '',
                startTime: startTime || '',
                endTime: endTime || '',
                class: item.class || ''
            };
        });
        return JSON.stringify(formattedSchedule, null, 2);
    }

    function handleConversion(conversionType) {
        loadPageContent(() => {
            setStatus(`Converting to ${conversionType}...`);
            const schedule = extractSchedule();
            let content, filename, mimeType;

            switch (conversionType) {
                case 'ICalendar':
                    content = convertToICS(schedule);
                    filename = 'upd_schedule.ics';
                    mimeType = 'text/calendar';
                    break;
                case 'CSV':
                    content = convertToCSV(schedule);
                    filename = 'upd_schedule.csv';
                    mimeType = 'text/csv';
                    break;
                case 'JSON':
                    content = convertToJSON(schedule);
                    filename = 'upd_schedule.json';
                    mimeType = 'application/json';
                    break;
            }

            downloadFile(content, filename, mimeType);
            setStatus(`${conversionType} file downloaded!`);
        });
    }

    convertICSButton.addEventListener('click', () => handleConversion('ICalendar'));
    convertCSVButton.addEventListener('click', () => handleConversion('CSV'));
    convertJSONButton.addEventListener('click', () => handleConversion('JSON'));
});
