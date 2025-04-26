import datetime
import pandas as pd
import os
from database.connection1 import get_collection

def calculate_salary():
    collection = get_collection()

    # Lấy thời gian hiện tại
    now = datetime.datetime.now()
    
    # Tạo start_date và end_date cho tháng hiện tại
    start_date = datetime.datetime(now.year, now.month, 1)
    if now.month == 12:
        end_date = datetime.datetime(now.year + 1, 1, 1)
    else:
        end_date = datetime.datetime(now.year, now.month + 1, 1)

    print(f"Calculating salary from {start_date} to {end_date}")

    # Truy vấn dữ liệu từ collection - không lọc theo timestamp vì muốn xem toàn bộ dữ liệu trước
    all_records = list(collection.find())
    print(f"Total records found: {len(all_records)}")
    
    # In một số bản ghi mẫu để kiểm tra cấu trúc dữ liệu
    if all_records:
        print("Sample record structure:")
        print(all_records[0])
    
    # Lọc các bản ghi trong tháng hiện tại
    # Giả định timestamp là một trường datetime hoặc chuỗi ngày tháng
    records_list = []
    for record in all_records:
        # Kiểm tra xem timestamp có đúng định dạng không
        if 'Timestamp' in record:
            timestamp_field = 'Timestamp'
        elif 'timestamp' in record:
            timestamp_field = 'timestamp'
        else:
            print("Warning: Record doesn't have timestamp field")
            continue
            
        # Xử lý timestamp có thể ở dạng chuỗi
        timestamp = record[timestamp_field]
        if isinstance(timestamp, str):
            try:
                # Thử chuyển đổi từ chuỗi định dạng "HH:MM ngày DD/MM/YYYY"
                time_part, date_part = timestamp.split(" ngày ")
                day, month, year = date_part.split("/")
                hour, minute = time_part.split(":")
                timestamp = datetime.datetime(int(year), int(month), int(day), int(hour), int(minute))
            except Exception as e:
                print(f"Error parsing timestamp: {e}")
                continue
        
        # Kiểm tra xem timestamp có trong khoảng thời gian hiện tại không
        if start_date <= timestamp < end_date:
            records_list.append(record)
    
    print(f"Found {len(records_list)} records for current month.")

    if not records_list:
        print("No records found for the specified date range.")
        return "No records found for the current month."

    # Dictionary để lưu dữ liệu lương theo từng người
    salary_data = {}
    
    # Dictionary để lưu chi tiết theo ngày
    daily_details = {}

    # Tỷ lệ lương mỗi giờ
    hourly_rate = 50000  # VND

    # Xử lý từng bản ghi
    for record in records_list:
        # Lấy thông tin cơ bản
        name = record.get('Name', record.get('name', 'Unknown'))
        
        # Xử lý timestamp
        if 'Timestamp' in record:
            timestamp_field = 'Timestamp'
        else:
            timestamp_field = 'timestamp'
            
        timestamp = record[timestamp_field]
        if isinstance(timestamp, str):
            try:
                # Thử chuyển đổi từ chuỗi định dạng "HH:MM ngày DD/MM/YYYY"
                time_part, date_part = timestamp.split(" ngày ")
                day, month, year = date_part.split("/")
                hour, minute = time_part.split(":")
                timestamp = datetime.datetime(int(year), int(month), int(day), int(hour), int(minute))
            except Exception as e:
                print(f"Error parsing timestamp: {e}")
                continue
        
        date_str = timestamp.strftime('%d/%m/%Y')
        
        # Lấy thông tin thời gian
        late_minutes_field = 'Late Minutes' if 'Late Minutes' in record else 'late_minutes'
        early_leave_field = 'Early Leave Minutes' if 'Early Leave Minutes' in record else 'early_leave_minutes'
        late_leave_field = 'Late Leave Minutes' if 'Late Leave Minutes' in record else 'late_leave_minutes'
        
        # Phân tích thời gian
        late_minutes = parse_time(record.get(late_minutes_field, '0:00:00'))
        early_leave_minutes = parse_time(record.get(early_leave_field, '0:00:00'))
        late_leave_minutes = parse_time(record.get(late_leave_field, '0:00:00'))
        
        # Tính tổng thời gian làm việc trong ngày
        # (16:00:00 - 07:00:00) - Late Minutes - Early Leave Minutes + Late Leave Minutes
        standard_work_hours = (datetime.datetime.strptime('16:00:00', '%H:%M:%S') - 
                              datetime.datetime.strptime('07:00:00', '%H:%M:%S')).seconds / 3600
        total_work_hours = standard_work_hours - (late_minutes + early_leave_minutes) / 60 + late_leave_minutes / 60

        print(f"Processing: {name} on {date_str}, Hours: {total_work_hours}")

        # Khởi tạo dữ liệu cho người này nếu chưa có
        if name not in salary_data:
            salary_data[name] = {
                'Name': name,
                'Month': now.strftime('%B %Y'),  # Tháng làm việc
                'Total Work Hours': 0,
                'Total Salary (VND)': 0,
                'Days Worked': set()
            }
            daily_details[name] = {}

        # Thêm giờ làm việc và lương vào tổng
        salary_data[name]['Total Work Hours'] += total_work_hours
        daily_salary = total_work_hours * hourly_rate
        salary_data[name]['Total Salary (VND)'] += daily_salary
        salary_data[name]['Days Worked'].add(date_str)
        
        # Lưu chi tiết theo ngày
        daily_details[name][date_str] = {
            'Work Hours': total_work_hours,
            'Daily Salary (VND)': daily_salary
        }

    # Chuyển đổi số ngày làm việc từ set sang số lượng
    for name in salary_data:
        salary_data[name]['Days Worked'] = len(salary_data[name]['Days Worked'])
        # Làm tròn tổng giờ làm việc và tổng lương
        salary_data[name]['Total Work Hours'] = round(salary_data[name]['Total Work Hours'], 2)
        salary_data[name]['Total Salary (VND)'] = round(salary_data[name]['Total Salary (VND)'], 2)

    if not salary_data:
        print("No salary data to write to Excel.")
        return "No salary data found for the period."

    print(f"Prepared salary data for {len(salary_data)} employees.")

    # Tạo DataFrame chính cho báo cáo lương
    df_salary = pd.DataFrame(salary_data.values())
    
    # Tạo file Excel với nhiều sheet
    excel_file = 'salary_report.xlsx'
    with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
        # Sheet tổng hợp
        df_salary.to_excel(writer, sheet_name='Summary', index=False)
        
        # Sheet chi tiết cho từng người
        for name in daily_details:
            if daily_details[name]:
                # Chuyển đổi dictionary thành DataFrame
                df_detail = pd.DataFrame.from_dict(daily_details[name], orient='index')
                df_detail.index.name = 'Date'
                df_detail.reset_index(inplace=True)
                df_detail.to_excel(writer, sheet_name=f'{name} Details', index=False)

    print(f"Salary report saved to {excel_file}")

    # Mở file Excel
    try:
        os.startfile(excel_file)
        print("Opened Excel file.")
    except Exception as e:
        print(f"File saved but could not be opened automatically: {e}")

    return f"Salary calculation completed and saved to {excel_file}"

def parse_time(time_str):
    """Phân tích chuỗi thời gian thành tổng số phút."""
    if not time_str or time_str == '0:00:00':
        return 0
    
    try:
        # Xử lý định dạng có thể có phần thập phân ở giây
        time_parts = str(time_str).split(':')
        hours = int(time_parts[0])
        minutes = int(time_parts[1])
        seconds = float(time_parts[2]) if len(time_parts) > 2 else 0
        total_minutes = hours * 60 + minutes + seconds / 60
        return total_minutes
    except Exception as e:
        print(f"Error parsing time string '{time_str}': {e}")
        return 0

if __name__ == "__main__":
    result = calculate_salary()
    print(result)