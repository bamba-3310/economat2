from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_user_active_session_id_user_session_started_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='session_last_seen',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
