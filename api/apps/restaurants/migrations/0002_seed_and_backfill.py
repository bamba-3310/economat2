from django.db import migrations


RESTAURANTS = (
    ("lecarre", "Le Carré"),
    ("bahiafc", "Bahia FC"),
)


def seed_and_backfill(apps, schema_editor):
    Restaurant = apps.get_model("restaurants", "Restaurant")
    Branding = apps.get_model("system", "Branding")

    restaurants = {}
    for slug, name in RESTAURANTS:
        obj, _ = Restaurant.objects.get_or_create(
            slug=slug, defaults={"name": name, "is_active": True}
        )
        restaurants[slug] = obj

    default = restaurants["lecarre"]

    # Keep at most one branding row per restaurant; drop orphan null rows after
    # assigning one of them to Le Carré if needed.
    if not Branding.objects.filter(restaurant_id=default.id).exists():
        orphan = Branding.objects.filter(restaurant_id__isnull=True).order_by("id").first()
        if orphan:
            orphan.restaurant_id = default.id
            orphan.save(update_fields=["restaurant_id"])
        else:
            Branding.objects.create(restaurant_id=default.id)

    Branding.objects.filter(restaurant_id__isnull=True).delete()

    for restaurant in restaurants.values():
        if not Branding.objects.filter(restaurant_id=restaurant.id).exists():
            Branding.objects.create(restaurant_id=restaurant.id)

    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == "postgresql":
            cursor.execute(
                "SELECT setval(pg_get_serial_sequence('branding','id'), "
                "COALESCE((SELECT MAX(id) FROM branding), 1))"
            )

    tenant_models = (
        ("categories", "Category"),
        ("suppliers", "Supplier"),
        ("articles", "Article"),
        ("batches", "Batch"),
        ("deliveries", "Delivery"),
        ("movements", "Movement"),
        ("alerts", "Alert"),
    )
    for app_label, model_name in tenant_models:
        Model = apps.get_model(app_label, model_name)
        Model.objects.filter(restaurant_id__isnull=True).update(restaurant_id=default.id)

    User = apps.get_model("accounts", "User")
    Membership = apps.get_model("restaurants", "RestaurantMembership")
    for user in User.objects.all():
        Membership.objects.get_or_create(user_id=user.id, restaurant_id=default.id)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0001_multi_tenant_restaurant"),
        ("accounts", "0005_user_photo_url"),
        ("categories", "0004_multi_tenant_restaurant"),
        ("suppliers", "0005_multi_tenant_restaurant"),
        ("articles", "0004_multi_tenant_restaurant"),
        ("batches", "0003_multi_tenant_restaurant"),
        ("deliveries", "0002_multi_tenant_restaurant"),
        ("movements", "0007_multi_tenant_restaurant"),
        ("alerts", "0003_multi_tenant_restaurant"),
        ("system", "0002_multi_tenant_restaurant"),
    ]

    operations = [
        migrations.RunPython(seed_and_backfill, noop_reverse),
    ]
