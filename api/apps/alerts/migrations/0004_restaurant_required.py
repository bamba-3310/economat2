import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0002_seed_and_backfill"),
        ("alerts", "0003_multi_tenant_restaurant"),
    ]

    operations = [
        migrations.AlterField(
            model_name="alert",
            name="restaurant",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="alerts",
                to="restaurants.restaurant",
            ),
        ),
    ]
