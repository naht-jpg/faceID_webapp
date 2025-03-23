from django.contrib import admin
from .models import Employee, Attendance

# Register your models
admin.site.register(Employee)
admin.site.register(Attendance)