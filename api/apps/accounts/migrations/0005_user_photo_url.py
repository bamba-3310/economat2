from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_session_last_seen'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='photo_url',
            field=models.TextField(blank=True, null=True),
        ),
    ]
