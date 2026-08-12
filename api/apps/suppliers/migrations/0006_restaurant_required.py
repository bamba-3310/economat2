import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0002_seed_and_backfill"),
        ("suppliers", "0005_multi_tenant_restaurant"),
    ]

    operations = [
        migrations.AlterField(
            model_name="supplier",
            name="restaurant",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="suppliers",
                to="restaurants.restaurant",
            ),
        ),
    ]
